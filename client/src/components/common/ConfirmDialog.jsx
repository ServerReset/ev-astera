import { useState, useCallback } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

/**
 * useConfirm — imperative confirm dialog. Returns [confirm, dialog]:
 *   const [confirm, dialog] = useConfirm();
 *   ... if (await confirm({ title, message, danger })) { ... }
 *   ... render {dialog}
 */
export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setState({ ...opts, resolve });
      }),
    []
  );

  const close = (result) => {
    state?.resolve?.(result);
    setState(null);
  };

  const dialog = (
    <Modal
      open={Boolean(state)}
      onClose={() => close(false)}
      title={state?.title || 'Are you sure?'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>
            {state?.cancelLabel || 'Cancel'}
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {state?.confirmLabel || 'Confirm'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted">{state?.message}</p>
    </Modal>
  );

  return [confirm, dialog];
}
