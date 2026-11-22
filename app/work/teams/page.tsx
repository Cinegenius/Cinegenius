import {Suspense} from 'react';
import {auth} from '@clerk/nextjs/server';
import {redirect} from 'next/navigation';
import WorkTeams from '@/components/work/WorkTeams';
export const metadata={robots:{index:false,follow:false}};
export default async function TeamsPage({searchParams}:{searchParams:Promise<{account?:string}>}) {
  const requested=(await searchParams).account;
  const {userId}=await auth();
  if(!userId)redirect('/sign-in?redirect_url='+encodeURIComponent('/work/teams'+(requested?'?account='+encodeURIComponent(requested):'')));
  // A native presentation is bound to the account it was opened for.
  return <Suspense><WorkTeams key={userId} accountId={userId} accountMatches={!requested||requested===userId}/></Suspense>;
}
