export const FORM_STEP_STYLES = `
  :host {
    display: block;
    min-width: 0;
    padding: var(--space-8);
    border-bottom: 1px solid var(--color-border);
  }

  fieldset {
    min-inline-size: 0;
    border: 0;
    margin: 0;
    padding: 0;
  }

  legend {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    margin: 0;
    padding: 0;
    font-size: 24px;
    line-height: 32px;
  }

  legend strong {
    min-width: 0;
    overflow-wrap: break-word;
  }

  legend span {
    display: grid;
    place-items: center;
    flex: 0 0 28px;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-control);
    background: var(--color-primary);
    color: var(--color-on-primary);
    font-size: 16px;
    font-weight: 700;
  }

  fieldset > p {
    margin: var(--space-1) 0 var(--space-6) 40px;
    color: var(--color-text-muted);
  }

  mat-form-field {
    width: 100%;
  }

  .unavailable {
    opacity: 0.55;
    pointer-events: none;
  }

  @media (max-width: 599px) {
    :host {
      padding: var(--space-6) var(--space-4);
    }

    legend {
      font-size: 20px;
      line-height: 28px;
    }

    fieldset > p {
      margin-left: 40px;
    }
  }
`;
