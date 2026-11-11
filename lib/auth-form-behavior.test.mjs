import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import * as errors from './auth-error-message.ts';
import * as signInFlow from './sign-in-flow.ts';
import * as passwordReset from './password-reset-flow.ts';
import {localizeAuthMessage} from './i18n/auth-messages.ts';

const require = createRequire(import.meta.url);
const locales = ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv'];
const source = readFileSync(new URL('../components/AuthForm.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(`${source}\nexport {SignInForm, SignUpForm};`, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
}).outputText;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}

/** Real JSX and event handlers; only hooks, navigation and Clerk I/O are controlled. */
function fixture({mode = 'sign-up', locale = 'de', loaded = true, initialStatus = 'missing_requirements', methods = {}} = {}) {
  let cursor = 0;
  let tree;
  let currentLocale = locale;
  let isLoaded = loaded;
  const hooks = [];
  const calls = [];
  const navigation = [];
  const fields = Object.fromEntries(['firstName', 'lastName', 'emailAddress', 'phoneNumber', 'password', 'username', 'identifier', 'code', 'captcha', 'legalAccepted'].map(key => [key, null]));
  const call = async (name, params) => {
    calls.push({name, params});
    return methods[name] ? methods[name](params, resource) : {error: null};
  };
  const resource = {
    status: initialStatus,
    requiredFields: ['email_address', 'password'],
    missingFields: [],
    supportedSecondFactors: [],
    password: params => call('password', params),
    reset: () => call('reset'),
    create: params => call('create', params),
    finalize: async params => {
      calls.push({name: 'finalize'});
      if (methods.finalize) return methods.finalize(params, resource);
      await params.navigate({session: {currentTask: null}, decorateUrl: url => url});
      return {error: null};
    },
    verifications: {
      sendEmailCode: () => call('signup.sendEmailCode'),
      verifyEmailCode: params => call('signup.verifyEmailCode', params),
    },
    emailCode: {
      sendCode: params => call('signin.sendEmailCode', params),
      verifyCode: params => call('signin.verifyEmailCode', params),
    },
    resetPasswordEmailCode: {
      sendCode: () => call('reset.sendCode'),
      verifyCode: params => call('reset.verifyCode', params),
      submitPassword: params => call('reset.submitPassword', params),
    },
    mfa: Object.fromEntries(['sendEmailCode', 'sendPhoneCode', 'verifyEmailCode', 'verifyPhoneCode', 'verifyTOTP', 'verifyBackupCode'].map(name => [name, params => call(`mfa.${name}`, params)])),
  };
  const translator = namespace => createTranslator({locale: currentLocale, messages: JSON.parse(readFileSync(new URL(`../messages/${currentLocale}.json`, import.meta.url), 'utf8')), namespace, onError(error) { throw error; }});
  const dependencies = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
        return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in hooks)) hooks[index] = {current: initial};
        return hooks[index];
      },
      useMemo: compute => compute(),
      useCallback: callback => callback,
      useEffect: () => {}, // Authentication and timer effects do not drive these submitted event handlers.
    },
    'next-intl': {useTranslations: translator, useLocale: () => currentLocale},
    '@clerk/nextjs': {
      useSignUp: () => ({signUp: resource, errors: {fields, global: null, raw: null}, fetchStatus: 'idle'}),
      useSignIn: () => ({signIn: resource, errors: {fields, global: null, raw: null}, fetchStatus: 'idle'}),
      useAuth: () => ({isLoaded, isSignedIn: false}),
      useClerk: () => ({navigate: async target => { navigation.push(target); }}),
    },
    'next/link': {__esModule: true, default: 'a'},
    'next/navigation': {useRouter: () => ({replace: target => navigation.push(target)})},
    'lucide-react': {Eye: 'i', EyeOff: 'i'},
    '@/lib/auth-error-message': errors,
    '@/lib/i18n/auth-messages': {localizeAuthMessage},
    '@/lib/sign-in-flow': signInFlow,
    '@/lib/password-reset-flow': passwordReset,
    'react/jsx-runtime': require('react/jsx-runtime'),
  };
  const loadedModule = {exports: {}};
  new Function('require', 'module', 'exports', 'window', compiled)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Uncontrolled dependency: ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports, {location: {origin: 'https://www.cinegenius.co'}});
  const walk = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
  const text = node => node == null || typeof node === 'boolean' ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
  const render = () => {
    cursor = 0;
    tree = loadedModule.exports[mode === 'sign-up' ? 'SignUpForm' : 'SignInForm']({destination: '/profile-setup?welcome=1', signInDestination: '/sign-in', signUpDestination: '/sign-up'});
  };
  const nodes = () => walk(tree);
  render();
  return {
    resource, calls, fields, navigation, render, nodes,
    t: key => translator()(key),
    text: () => text(tree),
    alerts: () => nodes().filter(node => node.props?.role === 'alert').map(text),
    submit: () => nodes().find(node => node.type === 'form').props.onSubmit({preventDefault() {}}),
    button: key => nodes().find(node => node.type === 'button' && text(node) === translator('auth')(key)),
    fill(typeOrId, value) {
      const input = nodes().find(node => node.type === 'input' && (node.props.id === typeOrId || (node.props.type ?? "text") === typeOrId));
      assert.ok(input, `Missing input ${typeOrId}`);
      input.props.onChange({target: {value}});
      render();
    },
    credentials() { this.fill('email', 'member@example.invalid'); this.fill('password', 'fixture-passphrase'); },
    setLoaded(value) { isLoaded = value; render(); },
    setLocale(value) { currentLocale = value; render(); },
  };
}

for (const locale of locales) {
  test(`${locale}: a rejected registration password explains the breach without exposing provider copy`, async () => {
    const f = fixture({locale, methods: {password: () => ({error: {errors: [{code: 'form_password_pwned', longMessage: 'PRIVATE member@example.invalid password=secret'}]}})}});
    f.credentials();
    await f.submit(); f.render();
    assert.deepEqual(f.alerts(), [f.t('auth.passwordCompromisedSignup')]);
    assert.doesNotMatch(f.text(), /PRIVATE|password=secret/);
    assert.deepEqual(f.calls.map(call => call.name), ['password']);
    assert.equal(f.nodes().find(node => node.type === 'input' && node.props.type === 'email').props.value, 'member@example.invalid');
  });

  for (const [code, key] of [['form_password_pwned', 'passwordPwnedSignIn'], ['form_password_compromised', 'passwordCompromisedSignIn'], ['form_password_not_set', 'passwordUnavailable']]) {
    test(`${locale}: sign-in provides the intended recovery for ${code}`, async () => {
      const f = fixture({mode: 'sign-in', locale, methods: {password: () => ({error: {code, message: 'PRIVATE provider details'}})}});
      f.credentials(); await f.submit(); f.render();
      assert.deepEqual(f.alerts(), [f.t(`auth.${key}`)]);
      assert.ok(f.button('forgotPassword'));
      assert.ok(f.button('emailSignIn'));
      assert.deepEqual(f.calls.map(call => call.name), ['password'], 'no automatic email or recovery request');
      assert.doesNotMatch(f.text(), /PRIVATE provider/);
    });
  }

  for (const [code, key] of [['verification_expired', 'codeExpired'], ['form_code_incorrect', 'codeIncorrect']]) {
    test(`${locale}: registration keeps verification required after ${code}`, async () => {
      const f = fixture({locale, methods: {'signup.verifyEmailCode': () => ({error: {errors: [{code}]}})}});
      f.credentials(); await f.submit(); f.render();
      assert.ok(f.button('verifyEmail'));
      f.fill('text', '123456'); await f.submit(); f.render();
      assert.deepEqual(f.alerts(), [f.t(`auth.${key}`)]);
      assert.ok(f.button('resendCode'));
      assert.equal(f.navigation.length, 0);
      assert.equal(f.calls.filter(call => call.name === 'finalize').length, 0);
    });
  }
}

test('thrown and returned errors use safe code mappings; unknown provider text never becomes UI', async () => {
  for (const [failure, key] of [[{code: 'too_many_requests'}, 'tooManyAttempts'], [new TypeError('Failed to fetch'), 'connectionError'], [{code: 'unrecognized_code', longMessage: 'PRIVATE email@example.invalid'}, 'registrationError']]) {
    for (const thrown of [false, true]) {
      const f = fixture({methods: {password: () => { if (thrown) throw failure; return {error: failure}; }}});
      f.credentials(); await f.submit(); f.render();
      assert.deepEqual(f.alerts(), [f.t(`auth.${key}`)]);
      assert.doesNotMatch(f.text(), /PRIVATE|email@example.invalid/);
    }
  }
  assert.equal(errors.authErrorMessageKey(Object.defineProperty({}, 'code', {get() { throw new Error('PRIVATE'); }})), null);
});

for (const mode of ['sign-up', 'sign-in']) {
  test(`${mode}: a truthy SDK proxy cannot submit until Clerk has loaded`, async () => {
    const f = fixture({mode, loaded: false});
    f.credentials();
    assert.equal(f.nodes().find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
    assert.ok(f.text().includes(f.t('auth.loadingService')));
    await f.submit();
    assert.equal(f.calls.length, 0);
    f.setLoaded(true);
    assert.equal(f.nodes().find(node => node.type === 'input' && node.props.type === 'email').props.value, 'member@example.invalid');
    await f.submit(); f.render();
    assert.equal(f.calls.filter(call => call.name === 'password').length, 1);
  });

  test(`${mode}: repeated events and rerenders cannot duplicate an in-flight password request`, async () => {
    const pending = deferred();
    const f = fixture({mode, methods: {password: () => pending.promise}});
    f.credentials();
    const first = f.submit();
    const repeatedBeforeRender = f.submit();
    f.render();
    assert.equal(f.nodes().find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
    await f.submit();
    assert.equal(f.calls.length, 1);
    pending.resolve({error: {code: 'too_many_requests'}});
    await Promise.all([first, repeatedBeforeRender]); f.render();
    assert.equal(f.nodes().find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
    assert.deepEqual(f.alerts(), [f.t('auth.tooManyAttempts')]);
  });
}

test('email-only registration gives the local password requirement without creating an account', async () => {
  const f = fixture(); f.fill('email', 'member@example.invalid');
  await f.submit(); f.render();
  assert.deepEqual(f.alerts(), [f.t('auth.passwordLength')]);
  assert.equal(f.calls.length, 0);
  assert.equal(f.nodes().find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});

for (const locale of locales) {
  test(`${locale}: password sign-in continues an explicit needs_new_password status`, async () => {
    const f = fixture({mode: 'sign-in', locale, methods: {password: (_params, resource) => { resource.status = 'needs_new_password'; return {error: null}; }, 'reset.submitPassword': (_params, resource) => { resource.status = 'complete'; return {error: null}; }}});
    f.credentials(); await f.submit(); f.render();
    assert.ok(f.button('savePassword'));
    assert.ok(f.text().includes(f.t('auth.passwordChangeRequired')));
    assert.equal(f.calls.filter(call => call.name.includes('sendCode') || call.name.includes('sendEmailCode')).length, 0);
    f.fill('reset-new-password', 'new-fixture-passphrase');
    f.fill('reset-confirm-password', 'new-fixture-passphrase');
    await f.submit(); f.render();
    assert.equal(f.calls.filter(call => call.name === 'reset.submitPassword').length, 1);
    assert.equal(f.calls.filter(call => call.name === 'finalize').length, 1);
    assert.deepEqual(f.navigation, ['/profile-setup?welcome=1']);
  });
}

test('a resumed password-change attempt survives loading and all nine locale changes without resetting entered passwords', () => {
  const f = fixture({mode: 'sign-in', loaded: false, initialStatus: 'needs_new_password'});
  assert.equal(f.button('savePassword'), undefined);
  f.setLoaded(true);
  f.fill('reset-new-password', 'new-fixture-passphrase');
  f.fill('reset-confirm-password', 'new-fixture-passphrase');
  for (const locale of locales) {
    f.setLocale(locale);
    assert.ok(f.button('savePassword'));
    assert.equal(f.nodes().find(node => node.props?.id === 'reset-new-password').props.value, 'new-fixture-passphrase');
    assert.equal(f.nodes().find(node => node.props?.id === 'reset-confirm-password').props.value, 'new-fixture-passphrase');
  }
  assert.equal(f.calls.length, 0);
});

test('an explicitly requested email-code sign-in can continue to a mandatory password change', async () => {
  const f = fixture({mode: 'sign-in', methods: {'signin.verifyEmailCode': (_params, resource) => { resource.status = 'needs_new_password'; return {error: null}; }}});
  f.fill('email', 'member@example.invalid');
  f.button('emailSignIn').props.onClick(); await new Promise(resolve => setImmediate(resolve)); f.render();
  f.fill('text', '123456'); await f.submit(); f.render();
  assert.ok(f.button('savePassword'));
  assert.deepEqual(f.calls.map(call => call.name), ['signin.sendEmailCode', 'signin.verifyEmailCode']);
  assert.equal(f.navigation.length, 0);
});

test('registration activates the session only after successful email verification', async () => {
  const f = fixture({methods: {'signup.verifyEmailCode': (_params, resource) => { resource.status = 'complete'; return {error: null}; }}});
  f.credentials(); await f.submit(); f.render();
  assert.equal(f.navigation.length, 0);
  f.fill('text', '123456'); await f.submit(); f.render();
  assert.deepEqual(f.calls.map(call => call.name), ['password', 'signup.sendEmailCode', 'signup.verifyEmailCode', 'finalize']);
  assert.deepEqual(f.navigation, ['/profile-setup?welcome=1']);
});

test('real second-factor requirements stay mandatory after password sign-in', async () => {
  const f = fixture({mode: 'sign-in', methods: {password: (_params, resource) => { resource.status = 'needs_second_factor'; resource.supportedSecondFactors = [{strategy: 'email_code'}]; return {error: null}; }}});
  f.credentials(); await f.submit(); f.render();
  assert.ok(f.button('verifyCode'));
  assert.ok(f.button('sendNewCode'));
  assert.deepEqual(f.calls.map(call => call.name), ['password', 'mfa.sendEmailCode']);
  assert.equal(f.navigation.length, 0);
});

const mfaCodeChannels = [
  ['email_code', 'mfa.sendEmailCode', 'Ui.text_a61a03e5cd6b6a'],
  ['phone_code', 'mfa.sendPhoneCode', 'Ui.text_463bc84306a541'],
];
const settleActions = () => new Promise(resolve => setImmediate(resolve));
const verificationInput = f => f.nodes().find(node => node.type === 'input' && node.props.autoComplete === 'one-time-code');

for (const locale of locales) {
  for (const [strategy, sendMethod, successKey] of mfaCodeChannels) {
    // Existing German legacy copy is normalized to the auth confirmation at display time.
    const visibleSuccessKey = locale === 'de' ? strategy === 'email_code' ? 'auth.sentEmail' : 'auth.sentPhone' : successKey;
    test(`${locale}: ${strategy} resend blocks same-render duplicates, clears the code only on success, and permits retry`, async () => {
      const pending = deferred();
      let sends = 0;
      const f = fixture({mode: 'sign-in', locale, methods: {
        password: (_params, resource) => {
          resource.status = 'needs_client_trust';
          resource.supportedSecondFactors = [{strategy}];
          return {error: null};
        },
        [sendMethod]: () => ++sends === 2 ? pending.promise : {error: null},
      }});
      f.credentials(); await f.submit(); f.render();
      f.fill('text', '123456');
      const resend = f.button('sendNewCode').props.onClick;
      resend();
      resend(); // The same closure still sees fetchStatus=idle and submitting=false.
      assert.equal(sends, 2, 'one initial code and one in-flight resend');
      f.render();
      assert.equal(f.button('sendNewCode').props.disabled, true);
      assert.equal(f.nodes().find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
      assert.equal(verificationInput(f).props.value, '123456', 'pending delivery does not discard the old code');
      assert.equal(f.nodes().filter(node => node.props?.role === 'status').length, 0);
      f.button('sendNewCode').props.onClick();
      await f.submit();
      assert.equal(sends, 2, 'rerenders and another verification event cannot bypass the lock');
      assert.equal(f.calls.filter(call => call.name.startsWith('mfa.verify')).length, 0);

      pending.resolve({error: null});
      await settleActions(); f.render();
      assert.equal(verificationInput(f).props.value, '');
      assert.equal(f.button('sendNewCode').props.disabled, false);
      assert.deepEqual(f.alerts(), []);
      assert.deepEqual(f.nodes().filter(node => node.props?.role === 'status').map(node => node.props.children), [f.t(visibleSuccessKey)]);

      f.fill('text', '654321');
      f.button('sendNewCode').props.onClick();
      await settleActions(); f.render();
      assert.equal(sends, 3, 'a completed request releases the synchronous lock');
      assert.equal(verificationInput(f).props.value, '');
      assert.equal(f.button('sendNewCode').props.disabled, false);
      assert.deepEqual(f.calls.map(call => call.name), ['password', sendMethod, sendMethod, sendMethod]);
      assert.deepEqual(f.navigation, []);
    });

    for (const failure of ['returned', 'thrown']) {
      test(`${locale}: ${strategy} ${failure} resend failure preserves the code, shows no success, and unlocks retry`, async () => {
        let sends = 0;
        const f = fixture({mode: 'sign-in', locale, methods: {
          password: (_params, resource) => {
            resource.status = 'needs_second_factor';
            resource.supportedSecondFactors = [{strategy}];
            return {error: null};
          },
          [sendMethod]: () => {
            sends += 1;
            if (sends !== 2) return {error: null};
            if (failure === 'thrown') throw new TypeError('Failed to fetch');
            return {error: {code: 'too_many_requests', longMessage: 'PRIVATE provider information'}};
          },
        }});
        f.credentials(); await f.submit(); f.render();
        f.fill('text', '123456');
        f.button('sendNewCode').props.onClick();
        await settleActions(); f.render();
        assert.equal(sends, 2);
        assert.equal(verificationInput(f).props.value, '123456');
        assert.deepEqual(f.alerts(), [f.t(failure === 'thrown' ? 'auth.connectionError' : 'auth.tooManyAttempts')]);
        assert.equal(f.nodes().filter(node => node.props?.role === 'status').length, 0, 'no stale or new sent confirmation after failure');
        assert.doesNotMatch(f.text(), /PRIVATE provider information/);
        assert.equal(f.button('sendNewCode').props.disabled, false);
        assert.equal(f.nodes().find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);

        f.button('sendNewCode').props.onClick();
        await settleActions(); f.render();
        assert.equal(sends, 3, 'both returned and thrown failures release the lock');
        assert.equal(verificationInput(f).props.value, '');
        assert.deepEqual(f.alerts(), []);
        assert.deepEqual(f.nodes().filter(node => node.props?.role === 'status').map(node => node.props.children), [f.t(visibleSuccessKey)]);
        assert.deepEqual(f.calls.map(call => call.name), ['password', sendMethod, sendMethod, sendMethod]);
        assert.deepEqual(f.navigation, []);
      });
    }
  }
}

for (const [strategy, sendMethod, verifyMethod] of [
  ['email_code', 'mfa.sendEmailCode', 'mfa.verifyEmailCode'],
  ['phone_code', 'mfa.sendPhoneCode', 'mfa.verifyPhoneCode'],
]) {
  test(`${strategy} cannot resend while the existing code is being verified, even before rerender`, async () => {
    const pending = deferred();
    const f = fixture({mode: 'sign-in', methods: {
      password: (_params, resource) => {
        resource.status = 'needs_second_factor';
        resource.supportedSecondFactors = [{strategy}];
        return {error: null};
      },
      [verifyMethod]: () => pending.promise,
    }});
    f.credentials(); await f.submit(); f.render();
    f.fill('text', '123456');
    const verification = f.submit();
    f.button('sendNewCode').props.onClick();
    assert.deepEqual(f.calls.map(call => call.name), ['password', sendMethod, verifyMethod]);
    assert.equal(verificationInput(f).props.value, '123456');
    pending.resolve({error: {code: 'form_code_incorrect'}});
    await verification; f.render();
    f.button('sendNewCode').props.onClick();
    await settleActions(); f.render();
    assert.deepEqual(f.calls.map(call => call.name), ['password', sendMethod, verifyMethod, sendMethod]);
    assert.equal(verificationInput(f).props.value, '');
    assert.deepEqual(f.navigation, []);
  });
}

for (const [strategy, verifyMethod] of [['totp', 'mfa.verifyTOTP'], ['backup_code', 'mfa.verifyBackupCode']]) {
  test(`${strategy} keeps verification available without offering or sending a replacement code`, async () => {
    const f = fixture({mode: 'sign-in', methods: {
      password: (_params, resource) => {
        resource.status = 'needs_second_factor';
        resource.supportedSecondFactors = [{strategy}];
        return {error: null};
      },
      [verifyMethod]: () => ({error: {code: 'form_code_incorrect'}}),
    }});
    f.credentials(); await f.submit(); f.render();
    assert.equal(f.button('sendNewCode'), undefined);
    f.fill('text', strategy === 'totp' ? '123456' : 'backup-code');
    await f.submit(); f.render();
    assert.deepEqual(f.calls.map(call => call.name), ['password', verifyMethod]);
    assert.deepEqual(f.alerts(), [f.t('auth.codeIncorrect')]);
    assert.equal(f.navigation.length, 0);
  });
}

for (const code of ['password_reset_required', 'password_too_long_needs_reset']) {
  test(`${code}: the actual sign-in form explains the required change and keeps recovery actions available`, async () => {
    const f = fixture({mode: 'sign-in', methods: {password: () => ({error: {errors: [{code}]}})}});
    f.credentials(); await f.submit(); f.render();
    assert.deepEqual(f.alerts(), [f.t('auth.passwordChangeRequired')]);
    assert.ok(f.button('forgotPassword'));
    assert.ok(f.button('emailSignIn'));
    assert.deepEqual(f.calls.map(call => call.name), ['password']);
    assert.equal(f.navigation.length, 0);
  });
}

test('a registration password matching the identifier shows password requirements without sending a code', async () => {
  const f = fixture({methods: {password: () => ({error: {code: 'form_password_matches_identifier'}})}});
  f.credentials(); await f.submit(); f.render();
  assert.deepEqual(f.alerts(), [f.t('auth.passwordRequirements')]);
  assert.deepEqual(f.calls.map(call => call.name), ['password']);
});

test('password validation failure means incorrect credentials for sign-in and requirements for a new password', async () => {
  for (const mode of ['sign-in', 'sign-up']) {
    const f = fixture({mode, methods: {password: () => ({error: {code: 'form_password_validation_failed'}})}});
    f.credentials(); await f.submit(); f.render();
    assert.deepEqual(f.alerts(), [f.t(mode === 'sign-in' ? 'auth.credentialsError' : 'auth.passwordRequirements')]);
  }
  const f = fixture({mode: 'sign-in', initialStatus: 'needs_new_password', methods: {'reset.submitPassword': () => ({error: {code: 'form_password_validation_failed'}})}});
  f.fill('reset-new-password', 'new-fixture-passphrase');
  f.fill('reset-confirm-password', 'new-fixture-passphrase');
  await f.submit(); f.render();
  assert.ok(f.text().includes(f.t('auth.passwordRequirements')));
  assert.ok(f.button('savePassword'));
  assert.equal(f.calls.filter(call => call.name === 'finalize').length, 0);
});
