import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen, Building2, Folder, Key, LayoutGrid, Mic, Package,
    ScissorsSquareIcon, Shield, Users, Vault, Video,
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

// Dashboard as a standalone item
const dashboardNavItem: NavItem = {
    title: 'Dashboard',
    href: dashboard(),
    icon: LayoutGrid,
};

// Services as a group with children
const servicesNavItem: NavItem = {
    title: 'Services',
    icon: Shield,
    children: [
        { title: 'Access Drive', href: '/services/drive', icon: Folder },
        { title: 'Access Vault', href: '/services/vault', icon: Vault },
        { title: 'Access Translator', href: '/services/translator', icon: Mic },
        { title: 'Access Encryption', href: '/services/encryption', icon: ScissorsSquareIcon },
        { title: 'Access Meeting', href: '/meet', icon: Video },
                { title: 'Secure DB', href: '/admin/secure-db', icon: Shield },
    ],
};

const footerNavItems: NavItem[] = [
    { title: 'Access tokens', href: '/access-token', icon: Key },
    { title: 'Documentation', href: '/document', icon: BookOpen },
];

export function AppSidebar() {
    const { auth } = usePage<{
        auth: { user?: { is_super_admin?: boolean; is_company_admin?: boolean } };
    }>().props;
    const user = auth?.user;

    const adminNavItems: NavItem[] = user?.is_super_admin
        ? [{
            title: 'Administration',
            icon: Shield,
            children: [
                { title: 'Services', href: '/admin/services', icon: Package },
                { title: 'Users', href: '/admin/users', icon: Users },
                { title: 'Companies', href: '/admin/organizations', icon: Building2 },
                { title: 'Secure DB', href: '/admin/secure-db', icon: Shield },
            ],
        }]
        : [];

    const companyNavItems: NavItem[] = (user?.is_super_admin || user?.is_company_admin)
        ? [{
            title: 'Company',
            icon: Building2,
            children: [
                { title: 'Credentials', href: '/company/credentials', icon: Key },
                { title: 'Users', href: '/company/users', icon: Users },
            ],
        }]
        : [];

    // Build nav items with Dashboard first, then Services, then admin/company items
    const navItems = [
        dashboardNavItem,
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
