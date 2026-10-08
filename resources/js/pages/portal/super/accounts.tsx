import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

type PageProps = {
    type: string;
    users: { data: any[] };
} & Record<string, unknown>;

export default function SuperAccounts() {
    const { type, users } = usePage<PageProps>().props;
    const title = type === 'super' ? 'Super Accounts' : 'Company Accounts';

    return (
        <PortalResourcePage
            title={title}
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: title, href: `/super/accounts/${type}` },
            ]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role' },
                { key: 'platform_role', label: 'Platform role', render: (r) => r.platform_role || '—' },
                { key: 'status', label: 'Status' },
                { key: 'organization', label: 'Company', render: (r) => r.organization?.name || '—' },
            ]}
            rows={users.data || []}
            storeUrl="/super/accounts"
            updateUrl={(r) => `/super/accounts/${r.id}`}
            deleteUrl={(r) => `/super/accounts/${r.id}`}
            fields={[
                { name: 'name', label: 'Name', required: true },
                { name: 'email', label: 'Email', type: 'email', required: true },
                { name: 'password', label: 'Password', type: 'password' },
                {
                    name: 'role',
                    label: 'Role',
                    type: 'select',
                    options: type === 'super'
                        ? [{ value: 'super', label: 'Super' }]
                        : [
                            { value: 'admin', label: 'Admin' },
                            { value: 'user', label: 'User' },
                        ],
                },
                ...(type === 'super' ? [{
                    name: 'platform_role',
                    label: 'Platform sub-role',
                    type: 'select' as const,
                    options: [
                        { value: 'general_admin', label: 'General Admin' },
                        { value: 'billing', label: 'Billing' },
                        { value: 'support', label: 'Support' },
                        { value: 'developer', label: 'Developer' },
                    ],
                }] : []),
                {
                    name: 'status',
                    label: 'Status',
                    type: 'select',
                    options: [
                        { value: 'pending', label: 'Pending' },
                        { value: 'active', label: 'Active' },
                        { value: 'block', label: 'Block' },
                    ],
                },
            ]}
        />
    );
}
