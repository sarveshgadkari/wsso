/** Who may review an employee-submitted TACTIC (direct manager only). */
export function canManagerReviewEmployeeTacticDoc(
  managerId: string,
  creator: { role: string; manager_id: string | null },
): boolean {
  return creator.role === 'employee' && creator.manager_id === managerId
}
