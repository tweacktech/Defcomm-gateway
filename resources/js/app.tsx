
import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import axios from 'axios';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';
import PageLoader from './components/page-loader';
import { initializeTheme } from './hooks/use-appearance';

// Web routes (meet signaling, join, broadcasting/auth) require the session cookie + CSRF token.
axios.defaults.withCredentials = true;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
if (csrf?.content) {
    axios.defaults.headers.common['X-CSRF-TOKEN'] = csrf.content;
}

configureEcho({
    broadcaster: 'reverb',
});

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <StrictMode>
                <PageLoader />
                <App {...props} />
            </StrictMode>,
        );
    },
    progress: {
        color: 'hsl(82, 61%, 26%)',
        showSpinner: false,
    },
});

// This will set light / dark mode on load...
initializeTheme();
