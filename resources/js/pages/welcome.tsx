import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import { login } from '@/routes';

type Props = {
  status?: string;
  canRegister: boolean;
};

export default function Welcome({
  status,
  canRegister,
}: Props) {
  return (
    <>
      <AuthLayout
        title="Welcome to Defcomm"
        description="Explore With Us"
      >
        <Head title="Welcome " />

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <TextLink href={login()} tabIndex={6}>
            Log in
          </TextLink>
        </div>


        <div className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <TextLink href={register()} tabIndex={5}>
            Sign up
          </TextLink>
        </div>



        {status && (
          <div className="mb-4 text-center text-sm font-medium text-green-600">
            {status}
          </div>
        )}
      </AuthLayout>

      {/* <footer>
        footers
        dkdkkkdkdkdkkddkddkdkdkd
        <br></br> jjjjjjjjjjjjjjj
      </footer> */}
    </>

  );
}
