import { Head, Link } from '@inertiajs/react';
import {
    Users,
    ShoppingCart,
    TrendingUp,
    Clock,
    ArrowUpRight,
    Settings,
    Package,
    AlertCircle
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

export default function Dashboard() {
    // Mock data - replace with actual data from your backend
    const stats = [
        {
            title: 'Total Revenue',
            value: '$45,231.89',
            change: '+20.1%',
            icon: TrendingUp,
            color: 'bg-green-500'
        },
        {
            title: 'Active Users',
            value: '2,350',
            change: '+12.3%',
            icon: Users,
            color: 'bg-blue-500'
        },
        {
            title: 'Total Orders',
            value: '354',
            change: '+8.2%',
            icon: ShoppingCart,
            color: 'bg-purple-500'
        },
        {
            title: 'Pending Orders',
            value: '12',
            change: '-2.1%',
            icon: Clock,
            color: 'bg-yellow-500'
        },
    ];

    const recentOrders = [
        { id: '#ORD-001', customer: 'John Doe', amount: '$235.50', status: 'completed', date: '2024-01-15' },
        { id: '#ORD-002', customer: 'Jane Smith', amount: '$125.99', status: 'processing', date: '2024-01-15' },
        { id: '#ORD-003', customer: 'Bob Johnson', amount: '$89.99', status: 'pending', date: '2024-01-14' },
        { id: '#ORD-004', customer: 'Alice Brown', amount: '$450.00', status: 'completed', date: '2024-01-14' },
        { id: '#ORD-005', customer: 'Charlie Wilson', amount: '$67.50', status: 'cancelled', date: '2024-01-13' },
    ];

    const services = [
        { name: 'Web Development', projects: 12, revenue: '$12,450', trend: 'up' },
        { name: 'UI/UX Design', projects: 8, revenue: '$8,320', trend: 'up' },
        { name: 'Consulting', projects: 5, revenue: '$6,780', trend: 'down' },
        { name: 'Maintenance', projects: 15, revenue: '$4,560', trend: 'up' },
    ];

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto p-6">
                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {stats.map((stat, index) => {
                        const Icon = stat.icon;
                        return (
                            <div
                                key={index}
                                className="relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-white p-6 dark:bg-sidebar-background"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                                        <p className="text-2xl font-bold">{stat.value}</p>
                                    </div>
                                    <div className={`rounded-lg ${stat.color} p-3 text-white`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <span className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                                        {stat.change}
                                    </span>
                                    <span className="text-sm text-muted-foreground">from last month</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Services and Quick Actions */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Services Card */}
                    <div className="relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-white p-6 dark:bg-sidebar-background lg:col-span-2">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Services Overview</h2>
                            <Link
                                href="/services"
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                                View all <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>
                        <div className="space-y-4">
                            {services.map((service, index) => (
                                <div key={index} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-3">
                                        <Package className="h-8 w-8 rounded-lg bg-primary/10 p-1.5 text-primary" />
                                        <div>
                                            <p className="font-medium">{service.name}</p>
                                            <p className="text-sm text-muted-foreground">{service.projects} active projects</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{service.revenue}</p>
                                        <p className={`text-sm ${service.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                            {service.trend === 'up' ? '↑' : '↓'} {service.trend === 'up' ? '+12%' : '-5%'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions Card */}
                    <div className="relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-white p-6 dark:bg-sidebar-background">
                        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
                        <div className="space-y-3">
                            <button className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-accent/50">
                                <div className="rounded-md bg-primary/10 p-2">
                                    <ShoppingCart className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-sm">Create new order</span>
                            </button>
                            <button className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-accent/50">
                                <div className="rounded-md bg-primary/10 p-2">
                                    <Users className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-sm">Add new user</span>
                            </button>
                            <button className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-accent/50">
                                <div className="rounded-md bg-primary/10 p-2">
                                    <Package className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-sm">Add new service</span>
                            </button>
                            <button className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-accent/50">
                                <div className="rounded-md bg-primary/10 p-2">
                                    <Settings className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-sm">System settings</span>
                            </button>
                        </div>

                        {/* Alert */}
                        <div className="mt-6 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                <div>
                                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                                        System Update Required
                                    </p>
                                    <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                                        Your system needs to be updated to the latest version.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Orders Table */}
                <div className="relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-white dark:bg-sidebar-background">
                    <div className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Recent Orders</h2>
                            <Link
                                href="/orders"
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                                View all orders <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b text-left text-sm">
                                        <th className="pb-3 font-medium">Order ID</th>
                                        <th className="pb-3 font-medium">Customer</th>
                                        <th className="pb-3 font-medium">Amount</th>
                                        <th className="pb-3 font-medium">Status</th>
                                        <th className="pb-3 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} className="border-b last:border-0">
                                            <td className="py-3">{order.id}</td>
                                            <td className="py-3">{order.customer}</td>
                                            <td className="py-3 font-medium">{order.amount}</td>
                                            <td className="py-3">
                                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="py-3 text-muted-foreground">{order.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
