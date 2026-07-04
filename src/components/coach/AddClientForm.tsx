export interface NewClientInput {
  name: string;
  email: string;
  password: string;
}

interface AddClientFormProps {
  value: NewClientInput;
  error: string;
  onChange: (value: NewClientInput) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function AddClientForm({ value, error, onChange, onCancel, onSubmit }: AddClientFormProps) {
  return (
    <div className="rounded-2xl glass-card p-6  space-y-4">
      <h3 className="text-base font-semibold text-white">הוספת מתאמן</h3>
      {error && <p className="text-sm text-red-300 bg-red-500/10 rounded-lg p-3 font-normal">{error}</p>}
      <input placeholder="שם" value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        className="w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all" />
      <input placeholder="אימייל" value={value.email} dir="ltr"
        onChange={(event) => onChange({ ...value, email: event.target.value })}
        className="w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all" />
      <input placeholder="סיסמה" type="password" value={value.password} dir="ltr"
        onChange={(event) => onChange({ ...value, password: event.target.value })}
        className="w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all" />
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel}
          className="flex-1 rounded-lg border border-[#444933] py-3 text-white font-semibold hover:bg-[#1e2020] transition-all">ביטול</button>
        <button onClick={onSubmit}
          className="flex-1 rounded-lg bg-[#c3f400] py-3 text-[#161e00] font-semibold hover:bg-[#d4ff26] transition-all">הוסף</button>
      </div>
    </div>
  );
}
