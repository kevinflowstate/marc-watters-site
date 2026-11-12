"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { formatFileSize, guessAttachmentType } from "@/lib/attachments";
import type { Attachment, CalendarEvent, RecurrenceType } from "@/lib/types";
import { Empty, Icon } from "@/components/ops/workspace/WorkspaceUI";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function EventEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folder, setFolder] = useState("General");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("19:00");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [recurrenceDay, setRecurrenceDay] = useState(0);
  const [link, setLink] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isActive, setIsActive] = useState(true);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/calendar");
        if (res.ok) {
          const data = await res.json();
          const found = data.events.find((e: CalendarEvent) => e.id === id);
          if (found) {
            setEvent(found);
            setTitle(found.title);
            setDescription(found.description || "");
            setFolder(found.folder || "General");
            setEventDate(found.event_date.split("T")[0]);
            setEventTime(found.event_time);
            setRecurrence(found.recurrence);
            setRecurrenceDay(found.recurrence_day ?? 0);
            setLink(found.link || "");
            setLinkLabel(found.link_label || "");
            setAttachments(found.attachments || []);
            setIsActive(found.is_active);
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function uploadAttachments(files: FileList | File[]): Promise<Attachment[]> {
    const uploaded: Attachment[] = [];

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "plan-documents");

      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload_failed");

      const data = await res.json();
      uploaded.push({
        id: crypto.randomUUID(),
        name: data.fileName || file.name,
        url: data.url,
        type: guessAttachmentType(file.name, file.type),
        size: formatFileSize(file.size),
      });
    }

    return uploaded;
  }

  async function saveField(updates: Partial<CalendarEvent>) {
    setSaving(true);
    try {
      await fetch("/api/admin/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      setEvent((prev) => (prev ? { ...prev, ...updates } : prev));
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  async function notifyClients() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notify_clients: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to notify clients");
      }

      toast("Clients notified");
    } catch {
      toast("Failed to notify clients", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await fetch("/api/admin/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.push("/admin/calendar");
    } catch {
      // Silently fail
    }
  }

  if (loading) {
    return (
      <div className="ws ws-page">
        <span className="ws-skel" style={{ width: 90, height: 12 }} />
        <span className="ws-skel" style={{ width: 260, height: 22 }} />
        <span className="ws-skel" style={{ height: 180, borderRadius: 10 }} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="ws ws-page">
        <Link href="/admin/calendar" className="ws-back ws-focus">
          <Icon name="chevron" size={14} className="ws-back-ic" />
          Back to calendar
        </Link>
        <div className="ws-panel">
          <Empty icon="calendar" title="Event not found." />
        </div>
      </div>
    );
  }

  return (
    <div className="ws ws-page ws-ev">
      <Link href="/admin/calendar" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Back to calendar
      </Link>

      {/* Event header card */}
      <div className="ws-ph">
        <div className="min-w-0 ws-ev-head">
          {editingTitle ? (
            <div className="ws-ev-edit">
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="ws-input ws-ev-title-in" aria-label="Event title" autoFocus />
              <button type="button" onClick={() => { setEditingTitle(false); saveField({ title }); }} className="ws-btn ws-btn-primary ws-focus">Save</button>
              <button type="button" onClick={() => { setTitle(event.title); setEditingTitle(false); }} className="ws-btn ws-btn-quiet ws-focus">Cancel</button>
            </div>
          ) : (
            <div className="ws-ev-line">
              <h1 className="ws-title">{title}</h1>
              <button type="button" onClick={() => setEditingTitle(true)} className="ws-btn ws-btn-quiet ws-btn-icon ws-focus ws-ev-pen" aria-label="Edit title">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          {editingDesc ? (
            <div className="ws-ev-desc-edit">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="ws-input" aria-label="Event description" autoFocus />
              <div className="ws-ev-btns">
                <button type="button" onClick={() => { setEditingDesc(false); saveField({ description }); }} className="ws-btn ws-btn-primary ws-btn-sm ws-focus">Save</button>
                <button type="button" onClick={() => { setDescription(event.description || ""); setEditingDesc(false); }} className="ws-btn ws-btn-quiet ws-btn-sm ws-focus">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="ws-ev-line is-desc">
              <p className="ws-meta ws-ev-desc">{description || "No description"}</p>
              <button type="button" onClick={() => setEditingDesc(true)} className="ws-btn ws-btn-quiet ws-btn-icon ws-btn-sm ws-focus ws-ev-pen" aria-label="Edit description">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="ws-ph-acts">
          {saving && (
            <span className="ws-caption">Saving...</span>
          )}
          <button
            type="button"
            onClick={notifyClients}
            disabled={saving}
            className="ws-btn ws-focus"
          >
            <Icon name="bell" size={14} />
            Notify clients
          </button>
          <button
            type="button"
            onClick={() => { setIsActive(!isActive); saveField({ is_active: !isActive }); }}
            className={`ws-btn ws-focus ws-ev-state ${isActive ? "is-on" : ""}`}
          >
            <span className="ws-dot" />
            {isActive ? "Active" : "Inactive - Click to activate"}
          </button>
        </div>
      </div>

      {/* Event details */}
      <section className="ws-panel" aria-label="Event details">
        <header className="ws-panel-head">
          <h2 className="ws-h2">Event details</h2>
        </header>
        <div className="ws-ev-form">
          <div>
            <label className="ws-label">Date</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} onBlur={() => saveField({ event_date: `${eventDate}T${eventTime}:00Z` })} className="ws-input" />
          </div>
          <div>
            <label className="ws-label">Time</label>
            <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} onBlur={() => saveField({ event_time: eventTime, event_date: `${eventDate}T${eventTime}:00Z` })} className="ws-input" />
          </div>
          <div>
            <label className="ws-label">Recurrence</label>
            <select value={recurrence} onChange={(e) => { const v = e.target.value as RecurrenceType; setRecurrence(v); saveField({ recurrence: v }); }} className="ws-input">
              <option value="none">One-off</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {recurrence !== "none" && (
            <div>
              <label className="ws-label">Recurrence day</label>
              <select value={recurrenceDay} onChange={(e) => { const v = Number(e.target.value); setRecurrenceDay(v); saveField({ recurrence_day: v }); }} className="ws-input">
                {dayNames.map((day, i) => <option key={i} value={i}>{day}</option>)}
              </select>
            </div>
          )}
          <div className="is-full">
            <label className="ws-label">Folder</label>
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              onBlur={() => saveField({ folder: folder || "General" })}
              placeholder="e.g. Catch-up calls"
              className="ws-input"
            />
          </div>
        </div>
      </section>

      {/* Link section */}
      <section className="ws-panel" aria-label="Meeting link">
        <header className="ws-panel-head">
          <h2 className="ws-h2">Meeting link</h2>
        </header>
        <div className="ws-ev-form">
          <div>
            <label className="ws-label">Link URL</label>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => saveField({ link: link || undefined })} placeholder="https://zoom.us/j/..." className="ws-input" />
          </div>
          <div>
            <label className="ws-label">Link label</label>
            <input type="text" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} onBlur={() => saveField({ link_label: linkLabel || undefined })} placeholder="e.g. Join Zoom" className="ws-input" />
          </div>
          {link && (
            <div className="is-full ws-ev-link">
              <Icon name="link" size={14} />
              <a href={link} target="_blank" rel="noopener noreferrer" className="ws-link ws-ev-link-a">{link}</a>
            </div>
          )}
        </div>
      </section>

      <section className="ws-panel" aria-label="Attachments">
        <header className="ws-panel-head">
          <h2 className="ws-h2">Attachments</h2>
        </header>
        <div className="ws-ev-files">
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
            onChange={async (e) => {
              const files = e.target.files;
              if (!files?.length) return;
              setUploadingAttachments(true);
              try {
                const uploaded = await uploadAttachments(files);
                const nextAttachments = [...attachments, ...uploaded];
                setAttachments(nextAttachments);
                await saveField({ attachments: nextAttachments });
              } finally {
                setUploadingAttachments(false);
                e.target.value = "";
              }
            }}
            className="ws-input ws-file"
          />
          {uploadingAttachments && <p className="ws-caption">Uploading...</p>}
          {attachments.length === 0 ? (
            <p className="ws-caption">No attachments yet.</p>
          ) : (
            <div className="ws-ev-files">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="ws-cal-file">
                  <div className="min-w-0 flex-1">
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ws-link ws-cal-file-n"
                    >
                      {attachment.name}
                    </a>
                    {attachment.size && <div className="ws-caption">{attachment.size}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextAttachments = attachments.filter((item) => item.id !== attachment.id);
                      setAttachments(nextAttachments);
                      await saveField({ attachments: nextAttachments });
                    }}
                    className="ws-btn ws-btn-quiet ws-btn-sm ws-focus ws-cal-remove"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="ws-panel" aria-label="Danger zone">
        <header className="ws-panel-head">
          <h2 className="ws-h2">Danger zone</h2>
        </header>
        <div className="ws-ev-danger">
          <p className="ws-caption">Deleting an event is permanent and cannot be undone.</p>
          {showDelete ? (
            <div className="ws-ev-btns">
              <span className="ws-ev-sure">Are you sure?</span>
              <button type="button" onClick={handleDelete} className="ws-btn ws-btn-danger ws-focus">
                Yes, delete event
              </button>
              <button type="button" onClick={() => setShowDelete(false)} className="ws-btn ws-btn-quiet ws-focus">Cancel</button>
            </div>
          ) : (
            <div className="ws-ev-btns">
              <button type="button" onClick={() => setShowDelete(true)} className="ws-btn ws-btn-danger ws-focus">
                Delete event
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
