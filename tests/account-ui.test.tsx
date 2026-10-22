import './ui-setup.mjs';
import React from 'react';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu } from '../src/components/AccountMenu';
import { ChangePasswordDialog } from '../src/components/ChangePasswordDialog';
import { DataTable } from '../src/ui/DataTable';

afterEach(() => { cleanup(); localStorage.clear(); });
const password = 'a new memorable passphrase';

async function fillForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Current password', { exact: true }), 'old password');
  await user.type(screen.getByLabelText('New password', { exact: true }), password);
  await user.type(screen.getByLabelText('Confirm new password', { exact: true }), password);
  return user;
}

test('Account menu uses the signed-in identity and supports keyboard close and opening password settings', async () => {
  localStorage.setItem('sopra-mesin-user', 'planner');
  localStorage.setItem('sopra-mesin-email', 'planner@example.com');
  localStorage.setItem('sopra-mesin-role', 'User');
  render(<AccountMenu />);
  const user=userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Account menu' }));
  assert.ok(screen.getByText('planner@example.com'));
  assert.ok(screen.getByRole('menuitem', { name: 'Logout' }));
  await user.keyboard('{Escape}');
  await waitFor(() => assert.ok(screen.queryByRole('menu') === null));
  await user.click(screen.getByRole('button', { name: 'Account menu' }));
  await user.click(screen.getByRole('menuitem', { name: 'Change password' }));
  assert.ok(screen.getByRole('dialog', { name: 'Change password' }));
  assert.ok(screen.queryByRole('menu') === null);
});

test('Mismatched confirmation is blocked before any request, and visibility toggle works', async () => {
  let requests=0;
  globalThis.fetch=async () => { requests++; throw new Error('Must not send'); };
  render(<ChangePasswordDialog onClose={() => {}} />);
  const user=await fillForm();
  await user.type(screen.getByLabelText('Confirm new password', {exact:true}), 'different');
  await user.click(screen.getByRole('button', {name:'Show new password', exact:true}));
  assert.equal(screen.getByLabelText('New password', {exact:true}).getAttribute('type'), 'text');
  await user.click(screen.getByRole('button', {name:'Update password'}));
  assert.match(screen.getByRole('alert').textContent ?? '', /do not match/);
  assert.equal(requests,0);
});

test('Rejected old password keeps the form and shows the server error inline', async () => {
  localStorage.setItem('sopra-mesin-token','old-session');
  globalThis.fetch=async () => new Response(JSON.stringify({success:false,message:'Password lama tidak sesuai'}), {status:400});
  render(<ChangePasswordDialog onClose={() => {}} />);
  const user=await fillForm();
  await user.click(screen.getByRole('button', {name:'Update password'}));
  await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '',/Password lama tidak sesuai/));
  assert.equal(localStorage.getItem('sopra-mesin-token'),'old-session');
  assert.ok(screen.getByLabelText('Current password', {exact:true}));
});

test('Successful password update rotates the token, clears password inputs, and prevents duplicate submissions', async () => {
  localStorage.setItem('sopra-mesin-token','old-session');
  localStorage.setItem('sopra-mesin-last-google-account','remembered-account');
  let requests=0;
  let complete!: (response:Response) => void;
  globalThis.fetch=async (_url, init) => {
    requests++;
    assert.equal((init?.headers as Record<string,string> | undefined)?.Authorization, 'Bearer old-session');
    assert.deepEqual(JSON.parse(String(init?.body)),{currentPassword:'old password',newPassword:password,confirmPassword:password});
    return new Promise(resolve => { complete=resolve; });
  };
  render(<ChangePasswordDialog onClose={() => {}} />);
  const user=await fillForm();
  await user.dblClick(screen.getByRole('button', {name:'Update password'}));
  assert.equal(requests,1);
  assert.equal((screen.getByRole('button', {name:'Updating…'}) as HTMLButtonElement).disabled,true);
  complete(new Response(JSON.stringify({success:true,data:{token:'new-session',username:'planner',email:'planner@example.com',role:'User'}}),{status:200}));
  await waitFor(() => assert.ok(screen.getByRole('heading',{name:'Password updated'})));
  assert.ok(screen.queryByLabelText('Current password',{exact:true}) === null);
  assert.equal(localStorage.getItem('sopra-mesin-token'),'new-session');
  assert.equal(localStorage.getItem('sopra-mesin-last-google-account'),'remembered-account');
});

test('Pagination has bounded controls for empty data and disables navigation during loading', async () => {
  const props={rows:[] as {id:string}[],rowKey:(row:{id:string})=>row.id,columns:[{key:'id',header:'ID',cell:(row:{id:string})=>row.id}],pagination:{page:1,pageSize:15,totalItems:0,totalPages:0,onPageChange:()=>{}}};
  const {rerender}=render(<DataTable {...props} />);
  assert.equal((screen.getByRole('button',{name:'Previous page'}) as HTMLButtonElement).disabled,true);
  assert.equal((screen.getByRole('button',{name:'Next page'}) as HTMLButtonElement).disabled,true);
  rerender(<DataTable {...props} isLoading pagination={{...props.pagination,totalItems:100,totalPages:7}} />);
  assert.equal((screen.getByRole('button',{name:'Next page'}) as HTMLButtonElement).disabled,true);
});
