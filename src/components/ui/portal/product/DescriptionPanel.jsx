import row from '@styles/ui/portal/product-row.module.css';

// Controlled by the sheet, which owns the one save. Her words stay in the box; another version only shows when it differs.
export function DescriptionPanel({
  value, onChange, badge, arrived, alternative, onUseAlternative, sourceText, agent,
}) {
  return (
    <div className={row.panel}>
      <label className={row.field} data-arrived={arrived || undefined}>
        <span className={row.split}>
          <span className={row.label}>
            What would you tell somebody in a shop who picked this up
            {badge}
          </span>
          <span className={row.count} data-num>{value.trim().length}</span>
        </span>
        <textarea
          className={row.textarea}
          rows={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Two or three sentences. What it is, who it suits, what it is for."
        />
      </label>

      {alternative && (
        <div className={row.draft}>
          <p className="micro">{agent}&apos;s version</p>
          <p className={row.draftBody}>{alternative}</p>
          <button type="button" className={row.ghost} onClick={onUseAlternative}>Use this instead</button>
        </div>
      )}

      {sourceText && (
        <details className={row.supplier}>
          <summary>What the supplier wrote</summary>
          <p>{sourceText}</p>
        </details>
      )}
    </div>
  );
}
