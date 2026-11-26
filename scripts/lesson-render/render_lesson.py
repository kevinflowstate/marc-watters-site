#!/usr/bin/env python3
"""Render local keep ranges into a new preview; never upload or publish."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path):
    result = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_format', '-show_streams',
         '-of', 'json', str(path)], check=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    duration = float(data['format']['duration'])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError('Source has no usable positive duration')
    if any(sum(s.get('codec_type') == kind for s in data['streams']) > 1
           for kind in ('video', 'audio')):
        raise ValueError('Multiple video or audio tracks need an explicit track-preserving edit plan')
    return duration, {s['codec_type'] for s in data['streams']}


def validate_plan(plan, duration):
    if plan.get('schema_version') != 1:
        raise ValueError('Expected schema_version 1')
    if not isinstance(plan.get('source_id'), str) or not plan['source_id'].strip():
        raise ValueError('A source_id is required')
    if not re.fullmatch(r'[0-9a-f]{64}', str(plan.get('source_sha256', ''))):
        raise ValueError('source_sha256 must be the actual lowercase SHA-256')
    expected = plan.get('source_duration_seconds')
    if (type(expected) not in (int, float) or not math.isfinite(expected)
            or expected <= 0 or abs(expected - duration) > 0.5):
        raise ValueError('Expected source duration does not match the media')
    ranges = plan.get('keep_ranges')
    if not isinstance(ranges, list) or not 1 <= len(ranges) <= 100:
        raise ValueError('Use 1–100 ordered keep ranges')
    previous_end = 0.0
    for pair in ranges:
        if (not isinstance(pair, list) or len(pair) != 2
                or any(type(v) not in (int, float) or not math.isfinite(v) for v in pair)):
            raise ValueError('Each keep range must be two finite numbers in seconds')
        start, end = pair
        if start < previous_end or start < 0 or end <= start or end > duration:
            raise ValueError('Keep ranges must be ordered, non-overlapping and within the source')
        if end - start < 0.1:
            raise ValueError('Keep ranges shorter than 0.1 seconds are not supported')
        previous_end = end
    return ranges


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--plan', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--dry-run', action='store_true', help='Validate source and plan; do not render')
    args = parser.parse_args()
    for tool in ('ffmpeg', 'ffprobe'):
        if not shutil.which(tool):
            raise ValueError(f'{tool} is missing; install it in the intended runtime')
    source, plan_path, output = (p.expanduser().resolve() for p in (args.source, args.plan, args.output))
    receipt = output.with_suffix('.receipt.json')
    if output.suffix.lower() != '.mp4':
        raise ValueError('Output must be an .mp4 file')
    if not source.is_file() or not plan_path.is_file():
        raise ValueError('Source and plan must be existing local files')
    if output in (source, plan_path) or receipt in (source, plan_path):
        raise ValueError('Output must not replace an input')
    if output.exists() or receipt.exists():
        raise ValueError('Output or receipt already exists; choose a new version filename')
    # Read once so the plan hash describes precisely the bytes used by this render.
    plan_bytes = plan_path.read_bytes()
    plan = json.loads(plan_bytes)
    duration, streams = probe(source)
    if not {'video', 'audio'}.issubset(streams):
        raise ValueError('This helper requires a video track and an audio track')
    ranges = validate_plan(plan, duration)
    source_hash = sha256(source)
    if source_hash != plan['source_sha256']:
        raise ValueError('Source hash differs from the edit plan; inspect the correct source')
    target_duration = sum(end - start for start, end in ranges)
    if args.dry_run:
        print(json.dumps({'status': 'validated_not_rendered', 'ranges': len(ranges),
                          'expected_output_seconds': target_duration,
                          'portal_limit_bytes': 256 * 1024 * 1024,
                          'portal_budget_total_bits_per_second': int((256 * 1024 * 1024 * 0.98 * 8) / target_duration),
                          'output_size_unknown_until_rendered': True,
                          'quality_policy': 'Preserve the full kept lesson and current CRF20 export. Never reduce quality or truncate to fit the portal limit without review.'}))
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(output.parent).free < source.stat().st_size * 3:
        raise ValueError('Insufficient free disk for the conservative 3x source-size estimate')
    filters, inputs = [], []
    for i, (start, end) in enumerate(ranges):
        filters.append(f'[0:v:0]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]')
        # Keep joins quiet without shifting the timeline or crossfading teaching.
        # The plan must already preserve a little space around spoken words.
        fade_out = max(0, end - start - 0.03)
        filters.append(f'[0:a:0]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,'
                       f'afade=t=in:st=0:d=0.03,afade=t=out:st={fade_out}:d=0.03[a{i}]')
        inputs.append(f'[v{i}][a{i}]')
    filters.append(''.join(inputs) + f'concat=n={len(ranges)}:v=1:a=1[vout][aout]')
    with tempfile.TemporaryDirectory(prefix='.cbb-render-', dir=output.parent) as temp:
        candidate = Path(temp) / 'preview.mp4'
        command = ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-n',
                   '-i', str(source), '-filter_complex_threads', '2',
                   '-filter_complex', ';'.join(filters), '-map', '[vout]', '-map', '[aout]',
                   '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
                   '-threads', '2', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(candidate)]
        subprocess.run(command, check=True, stdin=subprocess.DEVNULL)
        actual_duration, actual_streams = probe(candidate)
        if not {'video', 'audio'}.issubset(actual_streams) or abs(actual_duration - target_duration) > 0.5:
            raise ValueError('Rendered duration/streams failed verification; no output published')
        if sha256(source) != source_hash:
            raise ValueError('Source changed during rendering; discard and recheck the source')
        result = {'schema_version': 1, 'status': 'private_preview_not_published',
                  'source_id': plan['source_id'], 'source_sha256': source_hash,
                  'plan_sha256': hashlib.sha256(plan_bytes).hexdigest(),
                  'output_sha256': sha256(candidate), 'source_filename': source.name,
                  'output_filename': output.name, 'expected_duration_seconds': target_duration,
                  'actual_duration_seconds': actual_duration, 'keep_ranges': ranges,
                  'audio_fade_seconds': 0.03, 'output_bytes': candidate.stat().st_size}
        # Exclusive create/link prevents silent overwrite even if another render races us.
        with receipt.open('x') as stream:
            json.dump(result, stream, indent=2)
            stream.write('\n')
        try:
            os.link(candidate, output)
        except Exception:
            receipt.unlink()
            raise
    print(json.dumps({'status': result['status'], 'output': str(output),
                      'receipt': str(receipt), 'duration_seconds': actual_duration}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        print(f'Render failed: {error}', file=sys.stderr)
        sys.exit(1)
