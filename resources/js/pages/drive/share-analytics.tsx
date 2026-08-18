import { usePage } from '@inertiajs/react';
import { ArrowLeft, Download, Eye, Users, Smartphone, Globe, Calendar } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';

interface AccessLog {
    id: number;
    drive_share_id: number;
    ip_address: string;
    user_agent: string;
    browser: string;
    os: string;
    device: string;
    country_code?: string;
    city?: string;
    created_at: string;
}

interface Statistics {
    total_accesses: number;
    unique_ips: number;
    unique_browsers: number;
    browsers: Record<string, number>;
    devices: Record<string, number>;
    operating_systems: Record<string, number>;
    first_accessed?: string;
    last_accessed?: string;
    top_countries: Record<string, number>;
    latest_accesses: AccessLog[];
}

interface DriveItem {
    id: number;
    name: string;
    type: 'file' | 'folder';
    size: number;
}

type PageProps = {
    share: any;
    item: DriveItem;
    statistics: Statistics;
    access_logs: {
        data: AccessLog[];
        pagination: {
            total: number;
            per_page: number;
            current_page: number;
            last_page: number;
        };
    };
};

function StatCard({ icon: Icon, label, value, unit = '' }: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    unit?: string;
}) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {value}
                        <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-1">
                            {unit}
                        </span>
                    </p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
                    {Icon}
                </div>
            </div>
        </div>
    );
}

function Chart({ title, data }: { title: string; data: Record<string, number> }) {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">{title}</h3>
            <div className="space-y-3">
                {entries.map(([name, count]) => {
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    return (
                        <div key={name}>
                            <div className="mb-1 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {name || 'Unknown'}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {count} ({percentage.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                                <div
                                    className="h-full rounded-full bg-blue-500 transition-all"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function ShareAnalytics() {
    const { share, item, statistics, access_logs } = usePage<PageProps>().props;

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const fmtSize = (bytes: number): string => {
        if (!bytes) return '—';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / (1024 ** i)).toFixed(1)} ${units[i]}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Back Button */}
                <Link
                    href="/services/drive"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Drive
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Share Analytics
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        {item.name}
                        {item.type === 'file' && ` • ${fmtSize(item.size)}`}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        icon={<Eye className="h-6 w-6 text-blue-600" />}
                        label="Total Views"
                        value={statistics.total_accesses}
                    />
                    <StatCard
                        icon={<Users className="h-6 w-6 text-green-600" />}
                        label="Unique Visitors"
                        value={statistics.unique_ips}
                    />
                    <StatCard
                        icon={<Smartphone className="h-6 w-6 text-purple-600" />}
                        label="Unique Browsers"
                        value={statistics.unique_browsers}
                    />
                    <StatCard
                        icon={<Calendar className="h-6 w-6 text-orange-600" />}
                        label="First Access"
                        value={statistics.first_accessed ? formatDate(statistics.first_accessed).split(',')[0] : 'N/A'}
                    />
                </div>

                {/* Charts Grid */}
                <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Chart title="Browsers" data={statistics.browsers} />
                    <Chart title="Devices" data={statistics.devices} />
                    <Chart title="Operating Systems" data={statistics.operating_systems} />
                </div>

                {/* Latest Access Logs */}
                <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Recent Access Logs
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        IP Address
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Browser
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Device
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        OS
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Access Time
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {access_logs.data.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    >
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300 font-mono">
                                            {log.ip_address}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-400">
                                            {log.browser || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-400">
                                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                {log.device || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-400">
                                            {log.os || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(log.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {access_logs.data.length === 0 && (
                        <div className="px-6 py-12 text-center">
                            <p className="text-gray-500 dark:text-gray-400">
                                No access logs yet. This share link has not been accessed.
                            </p>
                        </div>
                    )}
                </div>

                {/* Pagination Info */}
                {access_logs.pagination.total > 0 && (
                    <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                        Showing {access_logs.data.length} of {access_logs.pagination.total} access logs
                    </div>
                )}
            </div>
        </div>
    );
}
