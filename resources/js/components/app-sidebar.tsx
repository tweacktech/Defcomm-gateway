import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen, Building2, Bell, Folder, Key, LayoutGrid, Mic, Package,
    MessageSquare, Radio, ScissorsSquareIcon, Shield, Users, Vault, Video,
    FileText, ClipboardList, Contact, Bug, Store, Mail, Globe, ScrollText,
} from 'lucide-react';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';
import AppLogo from './app-logo';
import { dashboard } from '@/routes';

const dashboardNavItem: NavItem = {
    title: 'Dashboard',
    href: dashboard(),
    icon: LayoutGrid,
};

const servicesNavItem: NavItem = {
    title: 'Services',
    icon: Shield,
    children: [
        { title: 'Access Drive', href: '/services/drive', icon: Folder },
        { title: 'Access Vault', href: '/services/vault', icon: Vault },
        { title: 'Access Translator', href: '/services/translator', icon: Mic },
        { title: 'Access Encryption', href: '/services/encryption', icon: ScissorsSquareIcon },
        { title: 'Access Meeting', href: '/meet', icon: Video },
        { title: 'Audio Calls', href: '/calls', icon: Radio },
    ],
};

const footerNavItems: NavItem[] = [
    { title: 'Access tokens', href: '/access-token', icon: Key },
    { title: 'Documentation', href: '/document', icon: BookOpen },
];

function canAccess(permissions: string[] | undefined, area: string): boolean {
    if (!permissions) return false;
    return permissions.includes('*') || permissions.includes(area);
}

function filterChildren(item: NavItem, permissions: string[] | undefined, areaMap: Record<string, string>): NavItem | null {
    if (!item.children?.length) return item;
    const children = item.children.filter((child) => {
        const area = areaMap[child.href as string];
        return !area || canAccess(permissions, area);
    });
    if (children.length === 0) return null;
    return { ...item, children };
}

export function AppSidebar() {
    const { auth } = usePage<{
        auth: {
            user?: {
                is_super_admin?: boolean;
                is_company_admin?: boolean;
                is_general_admin?: boolean;
                platform_permissions?: string[];
            };
        };
    }>().props;
    const user = auth?.user;
    const permissions = user?.platform_permissions;

    const workspaceNavItems: NavItem[] = [{
        title: 'Workspace',
        icon: MessageSquare,
        children: [
            { title: 'Chat', href: '/app/chat', icon: MessageSquare },
            { title: 'Contacts', href: '/app/contacts', icon: Contact },
            { title: 'Files', href: '/app/files', icon: Folder },
            { title: 'Groups', href: '/app/groups', icon: Users },
            { title: 'Walkie-Talkie', href: '/app/walkie', icon: Radio },
            { title: 'Profile', href: '/app/profile', icon: Users },
        ],
    }];

    const adminAreaMap: Record<string, string> = {
        '/admin/services': 'services',
        '/admin/users': 'users',
        '/admin/organizations': 'organizations',
        '/admin/secure-db': 'secure_db',
        '/super/accounts/super': 'users',
        '/super/accounts/admin': 'users',
        '/super/notifications': 'notifications',
        '/super/languages': 'languages',
        '/super/agreements': 'agreements',
        '/super/system-mails': 'system_mails',
        '/super/plans': 'plans',
        '/super/store/users': 'store',
        '/super/store/apps': 'store',
        '/super/bounty/users': 'bounty',
        '/super/bounty/reports': 'bounty',
        '/super/bounty/programs': 'bounty',
        '/super/bounty/categories': 'bounty',
        '/super/support/contacts': 'support',
        '/super/support/bookings': 'support',
    };

    const rawAdminNav: NavItem[] = user?.is_super_admin
        ? [{
            title: 'Administration',
            icon: Shield,
            children: [
                { title: 'Services', href: '/admin/services', icon: Package },
                { title: 'Users', href: '/admin/users', icon: Users },
                { title: 'Companies', href: '/admin/organizations', icon: Building2 },
                { title: 'Secure DB', href: '/admin/secure-db', icon: Shield },
                ...(user.is_general_admin ? [
                    { title: 'Super Accounts', href: '/super/accounts/super', icon: Users },
                    { title: 'Company Accounts', href: '/super/accounts/admin', icon: Building2 },
                ] : canAccess(permissions, 'users') ? [
                    { title: 'Company Accounts', href: '/super/accounts/admin', icon: Building2 },
                ] : []),
            ],
        }, {
            title: 'Settings',
            icon: ScrollText,
            children: [
                { title: 'Notifications', href: '/super/notifications', icon: Bell },
                { title: 'Languages', href: '/super/languages', icon: Globe },
                { title: 'Agreements', href: '/super/agreements', icon: FileText },
                { title: 'System Mail', href: '/super/system-mails', icon: Mail },
                { title: 'Plans', href: '/super/plans', icon: Package },
            ],
        }, {
            title: 'Store',
            icon: Store,
            children: [
                { title: 'Users', href: '/super/store/users', icon: Users },
                { title: 'Apps', href: '/super/store/apps', icon: Package },
            ],
        }, {
            title: 'Bounty',
            icon: Bug,
            children: [
                { title: 'Users', href: '/super/bounty/users', icon: Users },
                { title: 'Reports', href: '/super/bounty/reports', icon: FileText },
                { title: 'Programs', href: '/super/bounty/programs', icon: Package },
                { title: 'Categories', href: '/super/bounty/categories', icon: ClipboardList },
            ],
        }, {
            title: 'Support',
            icon: Mail,
            children: [
                { title: 'Contacts', href: '/super/support/contacts', icon: Contact },
                { title: 'Bookings', href: '/super/support/bookings', icon: FileText },
            ],
        }]
        : [];

    const adminNavItems = rawAdminNav
        .map((item) => filterChildren(item, permissions, adminAreaMap))
        .filter((item): item is NavItem => item !== null);

    const companyNavItems: NavItem[] = user?.is_company_admin
        ? [{
            title: 'Company',
            icon: Building2,
            children: [
                { title: 'Credentials', href: '/company/credentials', icon: Key },
                { title: 'Users', href: '/company/users', icon: Users },
                { title: 'Notifications', href: '/company/notifications', icon: Bell },
                { title: 'Groups', href: '/company/groups', icon: Users },
                { title: 'Forms', href: '/company/forms', icon: ClipboardList },
                { title: 'Files', href: '/company/files', icon: Folder },
                { title: 'Meetings', href: '/company/meetings', icon: Video },
                { title: 'Profile', href: '/company/profile', icon: Users },
            ],
        }]
        : [];

    const navItems = [
        dashboardNavItem,
        ...workspaceNavItems,
        servicesNavItem,
        ...adminNavItems,
        ...companyNavItems,
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={navItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
