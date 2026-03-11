import { Form, Head } from '@inertiajs/react';
import TextLink from '@/components/text-link';

import AuthLayout from '@/layouts/auth-layout';
import { login } from '@/routes';


type Props = {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
};

export default function error({

}: Props) {
    return (
        <AuthLayout
            title="Page not found"
            description="Go back to the home page"
        >
            <Head title="Error page" />

             <TextLink href='/' tabIndex={5}>
                                    Home page
                                </TextLink>
        </AuthLayout>
    );
}
