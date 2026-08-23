"use client";

import React from "react";
import { styled, type HTMLStyledProps } from "styled-system/jsx";
import { log } from "../config/logger";
import StyledButton from "./StyledButton";
import StyledText from "./StyledText";

/**
 * A file dropzone with image previews.
 *
 * Extracted from HopperGuard, where it replaced Chakra's `FileUpload` compound
 * component. Chakra supplied Root/HiddenInput/Dropzone/Trigger/ItemGroup/Item/
 * ItemPreviewImage/ItemDeleteTrigger plus `useFileUploadContext`; all of it is
 * reconstructed here on a local context, because the pieces share state (the
 * accepted files) and cannot be swapped one at a time.
 *
 * ## What must not be lost
 *
 * These are pinned by the originating app's e2e spec, and each one is easy to
 * break while the component still looks right:
 *
 *   - a real `<input type="file">` stays ATTACHED to the DOM
 *   - the dropzone is reachable and operable BY KEYBOARD — so the trigger is a
 *     real `<button>`, never a div with a click handler
 *   - the dropzone announces itself IN WORDS, not by icon alone
 *   - selecting a file does not tear the widget down
 *
 * ## Icons
 *
 * This package ships no artwork by policy (see `StyledAlert`), so both glyph
 * slots default to nothing and the words carry the meaning on their own. Pass
 * your own nodes to restore an icon set — HopperGuard's facade passes
 * `react-icons`' `LuFileImage` and `LuX`, which is what it rendered before the
 * extraction.
 */

interface FileUploadContextValue {
  acceptedFiles: File[];
  openPicker: () => void;
  removeFile: (file: File) => void;
}

const FileUploadContext = React.createContext<FileUploadContextValue | null>(
  null,
);

function useFileUploadContext(): FileUploadContextValue {
  const ctx = React.useContext(FileUploadContext);
  if (!ctx) {
    throw new Error(
      "useFileUploadContext must be used inside StyledImageUpload",
    );
  }
  return ctx;
}

const PandaVStack = styled("div", {
  base: { display: "flex", flexDirection: "column", alignItems: "center" },
});
const PandaItemGroup = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "2",
    justifyContent: "center",
  },
});
const PandaItem = styled("div", { base: { position: "relative" } });

/** Chakra's `Float` — the delete control at the item's top-end corner. */
const PandaFloat = styled("div", {
  base: {
    position: "absolute",
    top: "0",
    right: "0",
    transform: "translate(40%, -40%)",
  },
});

/**
 * `boxSize="4"` and `layerStyle="fill.solid"` were Chakra props with no Panda
 * equivalent — they do not exist on a `styled("button")` and the type-check
 * rejects both. Their effect is reproduced as real styles.
 *
 * The colours are tokens, never literals, so the control follows the host's
 * theme and colour mode.
 */
const PandaDeleteTrigger = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "4",
    height: "4",
    borderRadius: "full",
    cursor: "pointer",
    lineHeight: "1",
    bg: "boxBgPrimary",
    color: "textPrimary",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "borderBgPrimary",
  },
});

const PandaDropzone = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: "borderBgPrimary",
    borderRadius: "md",
    padding: "4",
  },
});

const PandaDropzoneContent = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2",
    textAlign: "center",
  },
});

/**
 * The preview image.
 *
 * A plain `<img>` on purpose: the source is an object URL for a file the user
 * just picked, so there is nothing for a framework image component to optimise
 * — it has no intrinsic dimensions to read, no remote host to whitelist, and no
 * cacheable URL. (In the originating Next.js app this needed a lint
 * suppression; this package has no such rule, so it needs none.)
 */
function PreviewImage({ file }: { file: File }) {
  const [src, setSrc] = React.useState<string>();
  /**
   * Creating the object URL in an effect keyed on the File — rather than inline
   * during render — is what stops a blob leaking on every re-render, and the
   * cleanup is what stops one leaking when the preview is removed.
   */
  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={file.name}
      // Inline rather than a Panda rule: a size a consumer's Panda `include`
      // glob might never extract is a size that silently does not apply.
      style={{
        borderRadius: "8px",
        objectFit: "cover",
        width: "96px",
        height: "96px",
        display: "block",
        margin: "0 auto",
      }}
    />
  );
}

export interface StyledImageUploadProps
  extends Omit<HTMLStyledProps<"div">, "onChange"> {
  /** Controlled-ish initial selection. Currently informational only. */
  value?: File[];
  onChange?: (files: File[]) => void;
  /** `1` keeps the input single-select; above 1 sets `multiple`. */
  maxFiles?: number;
  accept?: string;
  buttonText?: string;
  dropzoneText?: string;
  /** Decorative glyph inside the upload button. `aria-hidden`. */
  fileIcon?: React.ReactNode;
  /** Decorative glyph inside each remove button. `aria-hidden`. */
  removeIcon?: React.ReactNode;
}

const FileUploadPreviewOnly = ({
  removeIcon,
}: {
  removeIcon?: React.ReactNode;
}) => {
  const { acceptedFiles, removeFile } = useFileUploadContext();
  if (acceptedFiles.length === 0) return null;
  return (
    <PandaItemGroup>
      {acceptedFiles.map((file) => (
        <PandaItem p="2" key={file.name}>
          <PreviewImage file={file} />
          <PandaFloat>
            {/*
              The accessible name is on the BUTTON and names the file, so the
              glyph is decorative and hidden. A screen-reader user with three
              previews needs to know which one this removes.
            */}
            <PandaDeleteTrigger
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={() => removeFile(file)}
            >
              {removeIcon ? (
                <span aria-hidden="true">{removeIcon}</span>
              ) : null}
            </PandaDeleteTrigger>
          </PandaFloat>
        </PandaItem>
      ))}
    </PandaItemGroup>
  );
};

const FileUploadDropzoneOnly = ({
  buttonText,
  dropzoneText,
  fileIcon,
}: {
  buttonText: string;
  dropzoneText: string;
  fileIcon?: React.ReactNode;
}) => {
  const { openPicker } = useFileUploadContext();
  return (
    <PandaDropzone
      width="100%"
      cursor="pointer"
      onClick={openPicker}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <PandaDropzoneContent cursor="pointer">
        <StyledText cursor="pointer">{dropzoneText}</StyledText>
        {/*
          A real <button>, not the dropzone div with a handler: the control must
          be reachable and operable by KEYBOARD, and a div is neither focusable
          nor Enter/Space-activated. `stopPropagation` keeps the click from also
          reaching the dropzone and opening the picker twice.
        */}
        <StyledButton
          type="button"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            openPicker();
          }}
        >
          {buttonText}
          {fileIcon ? <span aria-hidden="true">{fileIcon}</span> : null}
        </StyledButton>
      </PandaDropzoneContent>
    </PandaDropzone>
  );
};

export function StyledImageUpload({
  onChange,
  maxFiles = 1,
  accept = "image/*",
  buttonText = "Upload Image",
  dropzoneText = "Drag and drop an image or",
  fileIcon,
  removeIcon,
  ...vStackProps
}: StyledImageUploadProps) {
  log.trace("StyledImageUpload rendered");
  const [acceptedFiles, setAcceptedFiles] = React.useState<File[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commit = React.useCallback(
    (files: File[]) => {
      const limited = maxFiles > 0 ? files.slice(0, maxFiles) : files;
      setAcceptedFiles(limited);
      onChange?.(limited);
    },
    [maxFiles, onChange],
  );

  const ctx = React.useMemo<FileUploadContextValue>(
    () => ({
      acceptedFiles,
      openPicker: () => inputRef.current?.click(),
      removeFile: (file) =>
        commit(acceptedFiles.filter((f) => f.name !== file.name)),
    }),
    [acceptedFiles, commit],
  );

  return (
    <FileUploadContext.Provider value={ctx}>
      {/*
        Chakra's HiddenInput. `display: none` would DETACH it from the
        accessibility tree; it is visually hidden the standard way instead so it
        stays reachable and stays a real form control.
      */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={(e) => commit(Array.from(e.target.files ?? []))}
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />
      <PandaVStack gap={2} {...vStackProps}>
        {acceptedFiles.length === 0 ? (
          <FileUploadDropzoneOnly
            buttonText={buttonText}
            dropzoneText={dropzoneText}
            fileIcon={fileIcon}
          />
        ) : (
          <FileUploadPreviewOnly removeIcon={removeIcon} />
        )}
      </PandaVStack>
    </FileUploadContext.Provider>
  );
}

export default StyledImageUpload;
