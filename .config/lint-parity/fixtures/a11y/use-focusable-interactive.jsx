export function SaveControl({ onSave }) {
  return (
    <div role="button" onClick={onSave} onKeyDown={onSave}>
      Save
    </div>
  );
}
