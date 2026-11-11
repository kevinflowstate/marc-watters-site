import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ getEnv: () => "https://eeatjpbwwkgytznkfdww.supabase.co" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { calendarStoragePath, lessonDate, pickCalendarWorkbook } from "@/lib/ops/calendar-workbook";

const BASE = "https://eeatjpbwwkgytznkfdww.supabase.co/storage/v1/object/public/plan-documents/";

describe("calendar workbook", () => {
  it("reads the date from the lesson reference", () => {
    expect(lessonDate("lesson:2026-10-13:from-sold-to-signed-off")).toBe("2026-10-13");
    expect(lessonDate("lesson:fathom-123")).toBeNull();
  });

  it("accepts only PDFs in the portal's own calendar storage", () => {
    expect(calendarStoragePath(`${BASE}1791896225700-69jqlp.pdf`)).toBe("1791896225700-69jqlp.pdf");
    expect(calendarStoragePath("https://evil.example/storage/v1/object/public/plan-documents/x.pdf")).toBeNull();
    expect(calendarStoragePath(`${BASE}../secret.pdf`)).toBeNull();
    expect(calendarStoragePath(`${BASE}x.docx`)).toBeNull();
    expect(calendarStoragePath(`${BASE}x.pdf?download=1`)).toBeNull();
  });

  it("picks the evening call's PDF, not the Word copy or a morning event", () => {
    const found = pickCalendarWorkbook([
      { id: "morning", title: "CBB LIVE Event", event_time: "09:30", updated_at: "2026-10-13T18:00:00Z", attachments: [{ name: "Agenda.pdf", type: "pdf", url: `${BASE}a.pdf` }] },
      {
        id: "call",
        title: "From Sold to Signed Off",
        event_time: "19:30",
        updated_at: "2026-10-13T12:57:10Z",
        attachments: [
          { name: "CBB_From_Sold_to_Signed_Off_Workbook.docx", type: "doc", url: `${BASE}1791896214579-bqur34.docx` },
          { name: "CBB_From_Sold_to_Signed_Off_Workbook.pdf", type: "pdf", url: `${BASE}1791896225700-69jqlp.pdf` },
        ],
      },
    ]);
    expect(found).toEqual({
      event_id: "call",
      event_title: "From Sold to Signed Off",
      storage_path: "1791896225700-69jqlp.pdf",
      name: "CBB_From_Sold_to_Signed_Off_Workbook.pdf",
    });
  });

  it("returns nothing when the call has no PDF attached, and tidies odd file names", () => {
    expect(pickCalendarWorkbook([{ id: "c", title: "Tuesday Night Call", event_time: "19:30", updated_at: "2026-11-10T11:51:20Z", attachments: [] }])).toBeNull();
    const odd = pickCalendarWorkbook([{ id: "c", title: "x", event_time: "19:30", updated_at: "2026-09-01T00:00:00Z", attachments: [{ name: "30 Day Review & Reset Workbook Aug..pdf", type: "pdf", url: `${BASE}1788276105615-1xqtey.pdf` }] }]);
    expect(odd?.name).toBe("30 Day Review & Reset Workbook Aug.pdf");
  });
});
