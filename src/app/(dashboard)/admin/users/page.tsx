import { saveUserModules } from '@/actions/admin/users';
import { prisma } from '@/lib/prisma';
import { APP_MODULES, MODULE_LABEL } from '@/lib/auth/modules';
import { can } from '@/lib/auth/rbac';
import { requireUser } from '@/lib/auth/session';
import { one, type SearchParams } from '@/lib/data/params';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  none: 'Tick at least one module, or deactivate the user instead.',
  admin: 'Administrators always have access to every module.',
  invalid: 'That user could not be found.',
};

export default async function UserAccessPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(user.role, 'users:manage')) redirect('/');

  let tableMissing = false;
  let users: {
    id: string; email: string; fullName: string; role: string; modules: { module: string }[];
  }[] = [];
  try {
    users = (await prisma.user.findMany({ orderBy: { email: 'asc' }, include: { modules: true } })) as typeof users;
  } catch (e) {
    console.error('[admin/users] could not load module access', e);
    tableMissing = true;
  }

  const error = ERRORS[one(searchParams, 'error') ?? ''];
  const saved = one(searchParams, 'saved') === '1';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">User access</h1>
        <p className="text-sm text-steel">
          Choose which modules each user can open. All ticked means unrestricted. Administrators always see everything.
        </p>
      </div>

      {saved && <p className="rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">Access saved.</p>}
      {error && <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      {tableMissing && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          The user_modules table does not exist yet. Run prisma/user-modules.sql in the Supabase SQL Editor, then reload.
        </p>
      )}

      <div className="space-y-2">
        {users.map((u) => {
          const isAdmin = u.role === 'ADMIN';
          const restricted = u.modules.length > 0;
          const has = new Set(u.modules.map((m) => m.module));
          return (
            <form key={u.id} action={saveUserModules} className="flex flex-wrap items-center gap-4 rounded border p-3">
              <input type="hidden" name="userId" value={u.id} />
              <div className="min-w-[14rem] flex-1">
                <div className="text-sm font-medium">{u.fullName || u.email}</div>
                <div className="text-xs text-steel">{u.email} · {u.role.replace('_', ' ')}</div>
              </div>
              {isAdmin ? (
                <span className="text-sm text-steel">All modules</span>
              ) : (
                <>
                  {APP_MODULES.map((m) => (
                    <label key={m} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" name="modules" value={m} defaultChecked={!restricted || has.has(m)} />
                      {MODULE_LABEL[m]}
                    </label>
                  ))}
                  <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">Save</button>
                </>
              )}
            </form>
          );
        })}
      </div>
    </div>
  );
}
