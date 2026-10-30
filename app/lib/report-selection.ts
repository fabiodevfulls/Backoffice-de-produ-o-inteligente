type ReportAttendant = { name: string; email: string };
type ReportActivity = { userEmail: string; userName?: string };

export function isDemoReportAccount(emailValue: string, nameValue = "") {
  const email = emailValue.trim().toLowerCase();
  const name = nameValue.trim().toLocaleLowerCase("pt-BR");
  return email.endsWith("@demo.invalid") || name === "acesso de demonstração";
}

export function teamMemberProductivity(member: { productiveSeconds: number; activeDays: number }, workdaySeconds: number) {
  if (workdaySeconds <= 0 || member.activeDays <= 0) return 0;
  return member.productiveSeconds / (workdaySeconds * member.activeDays);
}

export function filterReportSelection<Attendant extends ReportAttendant, Activity extends ReportActivity>(
  attendants: Attendant[],
  activities: Activity[],
  selectedEmails: string[],
) {
  const eligibleAttendants = attendants.filter((attendant) => !isDemoReportAccount(attendant.email, attendant.name));
  const selected = new Set(selectedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  const selectedAttendants = selected.size
    ? eligibleAttendants.filter((attendant) => selected.has(attendant.email.trim().toLowerCase()))
    : eligibleAttendants;
  const selectedAttendantEmails = new Set(selectedAttendants.map((attendant) => attendant.email.trim().toLowerCase()));
  const selectedActivities = activities.filter((activity) => {
    const email = activity.userEmail.trim().toLowerCase();
    return !isDemoReportAccount(email, activity.userName) && (!selected.size || selectedAttendantEmails.has(email));
  });

  return { attendants: selectedAttendants, activities: selectedActivities };
}
