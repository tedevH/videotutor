import { DemoWorksheet } from "../demo-worksheet";

/** Just the worksheet, for capturing the page image Lumo is asked about. Dev only. */
export default function WorksheetOnly() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main style={{ margin: 0, padding: 0 }}>
      <div id="sheet" style={{ display: "inline-block" }}>
        <DemoWorksheet />
      </div>
    </main>
  );
}
