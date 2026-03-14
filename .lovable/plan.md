

# Fix Camera Photo Capture — Direct Upload Pipeline

## Problem
The `capturePhoto` function in `CameraModal` calls `onCapture(file)` → parent's `handleFileSelect(file)` → shows upload form. There's a race condition where `handleClose()` is called after `onCapture` inside the `toBlob` callback, but `onCapture` already closes the modal (sets `cameraOpen = false`), causing double-close and potential state issues. Additionally, you want the photo to upload directly without the intermediate form step.

## Solution — Modify `CameraModal.capturePhoto` and parent `onCapture` callback

### 1. In `CameraModal` (lines 179–196)
- Remove the `handleClose()` call from inside `toBlob` — let `onCapture` handle closing
- The capture logic itself (drawImage → toBlob → File) is correct and stays as-is

### 2. In parent `onCapture` callback (lines 959–965)
Replace the current callback that goes through `handleFileSelect` with a direct upload function:

```
onCapture={async (file) => {
  setCameraOpen(false);
  // Direct upload — skip the form
  setUploading(true);
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Não autenticado");
    const storagePath = `${clinicId}/${pacienteId}/${Date.now()}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("patient-documents")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (storageError) throw storageError;
    const { error: dbError } = await (supabase as any).from("patient_documents").insert({
      clinic_id: clinicId,
      paciente_id: pacienteId,
      prontuario_id: prontuarioId,
      uploaded_by: userData.user.id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      category: "evolucao_clinica",
      description: null,
    });
    if (dbError) { await supabase.storage.from("patient-documents").remove([storagePath]); throw dbError; }
    toast.success("Foto capturada e guardada!");
    await fetchDocuments();
  } catch (err: any) {
    toast.error("Erro ao guardar foto: " + (err.message || "Tente novamente"));
  } finally {
    setUploading(false);
  }
}}
```

### Files changed
- `src/components/prontuarios/PatientDocuments.tsx` only — two edits:
  1. Remove `handleClose()` from line 191 in `capturePhoto`
  2. Replace `onCapture` callback (lines 962–964) with direct upload logic

