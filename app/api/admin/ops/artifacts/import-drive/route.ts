import { adminActor, respond } from "@/lib/ops/http";
import { readDriveContentPack } from "@/lib/ops/content-drive";
import {
  connectContentDrive,
  verifyContentDriveFile,
} from "@/lib/ops/drive-connection";
import { ContentPackError } from "@/lib/ops/content-pack";
import { submitArtifact, recordArtifactImport } from "@/lib/ops/actions";
import { OpsError, record } from "@/lib/ops/tasks";
import { validateArtifactDomain } from "@/lib/ops/artifact-execution";
export async function POST(request: Request) {
  return respond(async () => {
    const actor = await adminActor(),
      body = record(await request.json());
    if (
      Object.keys(body).some(
        (k) =>
          ![
            "file_id",
            "expected_version",
            "expected_sha256",
            "title",
            "external_ref",
            "expected_artifact_version",
            "expected_manifest_hash",
          ].includes(k),
      ) ||
      typeof body.file_id !== "string" ||
      typeof body.expected_version !== "string" ||
      typeof body.expected_sha256 !== "string" ||
      typeof body.title !== "string" ||
      typeof body.external_ref !== "string"
    )
      throw new OpsError(
        "Pinned Drive file, version, hash, title and reference required",
      );
    let imported;
    try {
      const connection = await connectContentDrive();
      await verifyContentDriveFile(body.file_id, connection);
      imported = await readDriveContentPack(
        {
          fileId: body.file_id,
          expectedVersion: body.expected_version,
          expectedSha256: body.expected_sha256,
        },
        { accessToken: connection.accessToken },
      );
      await verifyContentDriveFile(body.file_id, connection);
    } catch (error) {
      if (error instanceof ContentPackError)
        throw new OpsError(error.message, error.status);
      throw new OpsError(
        "Pinned Drive content could not be read; check the server connection",
        503,
      );
    }
    const artifact = await submitArtifact(
      {
        kind: "content",
        action: "schedule_content",
        title: body.title,
        external_ref: body.external_ref,
        payload: imported.pack,
        destination: { location_id: imported.pack.location_id },
        item_keys: imported.pack.posts.map((p) => p.post_id),
        ...(body.expected_artifact_version !== undefined ||
        body.expected_manifest_hash !== undefined
          ? {
              expected_version: body.expected_artifact_version,
              expected_manifest_hash: body.expected_manifest_hash,
            }
          : {}),
      },
      actor,
    );
    validateArtifactDomain(artifact);
    const source = await recordArtifactImport(
      artifact.id,
      { provider: "google_drive", ...imported.source },
      actor,
    );
    return { artifact, source };
  });
}
