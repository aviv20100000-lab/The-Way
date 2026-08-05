export function formatHebrewCount(count: number, forms: { one: string; plural: string }): string {
  return count === 1 ? forms.one : `${count} ${forms.plural}`;
}
