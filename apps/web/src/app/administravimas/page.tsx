import { redirect } from 'next/navigation';

/** The admin area's first real section is Users. */
export default function AdminIndexPage() {
  redirect('/administravimas/naudotojai');
}
