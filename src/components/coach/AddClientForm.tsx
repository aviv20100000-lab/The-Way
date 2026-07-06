export interface NewClientInput {
  name: string;
  email: string;
  password: string;
  groupIds: string[];
}

interface AddClientFormProps {
  value: NewClientInput;
  groups: { id: string; name: string }[];
  error: string;
  onChange: (value: NewClientInput) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function AddClientForm({ value, groups, error, onChange, onCancel, onSubmit }: AddClientFormProps) {
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
      <div>
        <p className="mb-2 text-xs font-semibold text-[#c4c9ac]">הוסף לקבוצה</p>
        <div className="space-y-2">
          {groups.map((group) => {
            const checked = value.groupIds.includes(group.id);
            return (
              <label key={group.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${checked ? "border-[#c3f400]/40 bg-[#c3f400]/10 text-white" : "border-[#444933] bg-[#282a2b] text-[#c4c9ac]"}`}>
                <input type="checkbox" checked={checked}
                  onChange={() => onChange({
                    ...value,
                    groupIds: checked ? value.groupIds.filter((id) => id !== group.id) : [...value.groupIds, group.id],
                  })}
                  className="h-4 w-4 accent-[#c3f400]" />
                <span>{group.name}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel}
          className="flex-1 rounded-lg border border-[#444933] py-3 text-white font-semibold hover:bg-[#1e2020] transition-all">ביטול</button>
        <button onClick={onSubmit}
          className="flex-1 rounded-lg bg-[#c3f400] py-3 text-[#161e00] font-semibold hover:bg-[#d4ff26] transition-all">הוסף</button>
      </div>
    </div>
  );
}
