/**
 * useZodForm — minimal form state + Zod validation using the SAME schemas the server
 * enforces (imported from @shared/validation). Keeps a values object, per-field errors,
 * and a submit wrapper that validates then calls the handler with parsed data.
 */
import { useCallback, useState } from 'react';

export function useZodForm(schema, initialValues = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setField(name, type === 'checkbox' ? checked : value);
  }, [setField]);

  const validate = useCallback(() => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return { ok: true, data: result.data };
    }
    const fieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] ?? '_form';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    setErrors(fieldErrors);
    return { ok: false, errors: fieldErrors };
  }, [schema, values]);

  const handleSubmit = useCallback(
    (onValid) => async (e) => {
      e?.preventDefault?.();
      const res = validate();
      if (!res.ok) return;
      setSubmitting(true);
      try {
        await onValid(res.data);
      } finally {
        setSubmitting(false);
      }
    },
    [validate]
  );

  const setServerErrors = useCallback((details) => {
    if (details && typeof details === 'object') setErrors((e) => ({ ...e, ...details }));
  }, []);

  return {
    values,
    errors,
    submitting,
    setField,
    setValues,
    handleChange,
    handleSubmit,
    validate,
    setServerErrors,
  };
}
