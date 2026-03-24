import { Link } from '@inertiajs/react';
import { BookOpen, Folder, Key, LayoutGrid, Mic, ScissorsSquareIcon, Settings, Vault, Video } from 'lucide-react';
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

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
   {
        title: 'Access Drive',
        href: '/services/drive',
        icon: Folder,
    },
    {
        title: 'Access vault',
        href: '/services/vault',
        icon: Vault,
    },
    {
        title: 'Access Translator',
        href: '/services/translator',
        icon: Mic,
    },
    {
        title: 'Access Encryption',
        href: '/services/encryption',
        icon: ScissorsSquareIcon ,
    },
    {
        title: 'Access Meeting',
        href: '/meet',
        icon: Video ,
    },

];

const footerNavItems: NavItem[] = [
   {
        title: 'Access tokens',
        href: '/access-token',
        icon: Key,
    },
    // {
    //     title: 'Repository',
    //     href: '/',
    //     icon: Folder,
    // },
    {
        title: 'Documentation',
        href: '/document',
        icon: BookOpen,
    },
];

export function AppSidebar() {
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
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
