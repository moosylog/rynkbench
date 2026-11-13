// Library: layouts as files. Open or import one, save a copy in each format
// the board's tools write, and carry a layout over to the board's sibling.
// The actions are the workbench's one document transfer (the top bar shows
// the workspace name it keeps).

import { useRef } from "react";
import type { ReactNode } from "react";
import { FORMAT_EXTENSION, FORMAT_LABEL } from "../../config/document";
import { useSharedDocumentTransfer } from "../transfer-actions";
import { TransferReportPanel } from "../TransferReport";
import { Button, Panel, SectionLabel } from "../kit";
import { useWorkbench } from "../state";

function Card({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <div>
        <div className="text-ui font-semibold text-ink">{title}</div>
        <p className="mt-1 text-small leading-relaxed text-faint">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </Panel>
  );
}

export function LibraryMode() {
  const { bundle, history } = useWorkbench();
  const transfer = useSharedDocumentTransfer();
  const fileInput = useRef<HTMLInputElement>(null);
  const offline = bundle.session.kind === "offline";
  const { documentTools, phase, report, dismissReport, importFile, exportFile, migrationTarget, previewMigration } =
    transfer;
  const busy = phase !== null || history.phase !== "idle";
  const busyReason = phase !== null ? "Wait for the file in progress" : "Wait for the keyboard to finish saving";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-8">
        <SectionLabel>Files</SectionLabel>

        {report && <TransferReportPanel report={report} onDismiss={dismissReport} inline />}

        {!documentTools ? (
          <Panel className="p-5">
            <div className="text-ui font-semibold text-ink">No file formats for this keyboard yet</div>
            <p className="mt-1 text-small leading-relaxed text-faint">
              Edits go straight to the keyboard. Opening and saving layouts as files arrives with this board's
              profile.
            </p>
          </Panel>
        ) : (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={documentTools.formats.map((format) => `.${FORMAT_EXTENSION[format]}`).join(",")}
              className="hidden"
              onChange={importFile}
            />
            <Card
              title={offline ? "Open a layout" : "Import a layout"}
              hint={offline ? "Open a layout file to edit it here." : documentTools.importHint}
            >
              <Button variant="primary" disabled={busy} reason={busyReason} onClick={() => fileInput.current?.click()}>
                {phase === "importing" ? "Opening…" : offline ? "Open file" : "Import layout"}
              </Button>
            </Card>

            <Card
              title="Save a copy"
              hint={offline ? "Download this layout as a file." : "Download what the keyboard holds now as a file."}
            >
              {documentTools.formats.map((format) => (
                <Button key={format} disabled={phase !== null} reason={busyReason} onClick={() => void exportFile(format)}>
                  {phase === "exporting" ? "Saving…" : FORMAT_LABEL[format]}
                </Button>
              ))}
            </Card>

            {migrationTarget && (
              <Card
                title={`Move to ${migrationTarget}`}
                hint={`See what carries over to a ${migrationTarget}, then download its layout.`}
              >
                <Button disabled={busy} reason={busyReason} onClick={() => void previewMigration()}>
                  {phase === "migrating" ? "Preparing…" : `Preview for ${migrationTarget}`}
                </Button>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
