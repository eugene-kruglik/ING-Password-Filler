<script lang="ts">
  import { onMount } from "svelte";

  const MASKED_BOX_NAME_PREFIX = "password-";
  const NEXT_STEP_BUTTON_TAG = "ing-button";
  const PAGE_STATE_CHECK_INTERVAL = 500;
  // Grace period, so that the panel survives the reload between the two login steps.
  const CHECKS_WITHOUT_LOGIN_FORM_BEFORE_HIDING = 6;

  let loginElement: HTMLInputElement;
  let passwordElement: HTMLInputElement;
  let isCollapsed = false;
  let hasSeenLoginForm = false;
  let checksWithoutLoginForm = 0;

  // The content script covers the whole /mojeing/app/* space, which includes the banking app
  // itself - show the panel only around a login form, never on top of the logged-in app.
  $: isVisible = hasSeenLoginForm && checksWithoutLoginForm < CHECKS_WITHOUT_LOGIN_FORM_BEFORE_HIDING;

  onMount(() => {
    checkPageState();

    const interval = setInterval(checkPageState, PAGE_STATE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  });

  const checkPageState = () => {
    if (findLoginFormInput()) {
      hasSeenLoginForm = true;
      checksWithoutLoginForm = 0;
      return;
    }

    if (checksWithoutLoginForm >= CHECKS_WITHOUT_LOGIN_FORM_BEFORE_HIDING) return;

    ++checksWithoutLoginForm;

    // The login form is gone for good - the user is either inside the banking app or somewhere
    // else entirely, so drop what they typed.
    if (checksWithoutLoginForm === CHECKS_WITHOUT_LOGIN_FORM_BEFORE_HIDING && hasSeenLoginForm) {
      clearCredentials();
    }
  };

  // Either the first login step (username) or the second one (masked password boxes).
  const findLoginFormInput = (): Element | null =>
    getInputByNameAttribute("login") ?? getInputByNameAttribute(`${MASKED_BOX_NAME_PREFIX}0`);

  const clearCredentials = () => {
    loginElement.value = "";
    passwordElement.value = "";
  };

  const t = (translationKey: string): string => chrome.i18n.getMessage(translationKey) || translationKey;

  const goToNextLoginStep = () => {
    const nextStepButton = getButtonByTagName(NEXT_STEP_BUTTON_TAG) as HTMLButtonElement | null;

    nextStepButton?.click();
  };

  const fillInput = (input: HTMLInputElement, newValue: string) => {
    const dispatchEvent = (eventName: string) =>
      input.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true }));

    input.value = newValue;

    dispatchEvent("input");
    dispatchEvent("keyup");
    dispatchEvent("change");
  };

  const onLoginFill = () => {
    const loginInput = getInputByNameAttribute("login") as HTMLInputElement | null;
    const login = loginElement.value;

    if (!loginInput || login.length === 0) return;

    fillInput(loginInput, login);
    goToNextLoginStep();
  };

  const onPasswordFill = () => {
    const passwordCharacters = passwordElement.value.split("");
    let hasFilledAnyBox = false;

    for (let i = 0; i < passwordCharacters.length; ++i) {
      const maskedBox = getInputByNameAttribute(`${MASKED_BOX_NAME_PREFIX}${i}`) as HTMLInputElement | null;

      if (!maskedBox) break;

      if (!maskedBox.disabled) {
        fillInput(maskedBox, passwordCharacters[i]);
        hasFilledAnyBox = true;
      }
    }

    if (!hasFilledAnyBox) return;

    // Credentials are wiped by checkPageState as soon as the banking app shows up.
    isCollapsed = true;
    goToNextLoginStep();
  };

  const getInputByNameAttribute = (name: string): Element | null =>
    findElementRecursive(
      (e) => e.localName === "input" && e.attributes.getNamedItem("name")?.value === name,
      document.body
    );

  const getButtonByTagName = (tagName: string): Element | null =>
    findElementRecursive(
      (e) => e.localName === tagName && e.attributes.getNamedItem("role")?.value === "button",
      document.body
    );

  const findElementRecursive = (test: (e: Element) => boolean, element: Element): Element | null => {
    if (test(element)) return element;

    const children = [...element.children, ...(element.shadowRoot?.children ?? [])];

    for (const child of children) {
      const foundChild = findElementRecursive(test, child);

      if (foundChild) return foundChild;
    }

    return null;
  };
</script>

<div class="mpf-background" class:mpf-collapsed={isCollapsed} class:mpf-gone={!isVisible}>
  <button class="mpf-toggle" on:click={() => (isCollapsed = !isCollapsed)}>
    <i class="mpf-arrow mpf-downleft" />
  </button>
  <div class="mpf-content">
    <div class="mpf-wrapper">
      <div class="mpf-title">{t("fill_header_title")}<br />{t("fill_header_description")}</div>
      <input bind:this={loginElement} id="mpf-login-input" class="form-control mpf-input" type="text" />
      <button class="mpf-button" on:click={onLoginFill}>{t("fill_login")}</button>
      <input bind:this={passwordElement} id="mpf-password-input" class="form-control mpf-input" type="password" />
      <button class="mpf-button" on:click={onPasswordFill}>{t("fill_password")}</button>
    </div></div
  >
</div>

<style lang="scss">
  .mpf-content {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    height: var(--visible-circle-size);
  }

  .mpf-background {
    --ing-color: #ff6200;
    --visible-circle-size: 40rem;
    --toggle-size: 3rem;
    --root-2: 1.4142;
    position: fixed;
    bottom: calc(-1 * var(--visible-circle-size));
    left: calc(-1 * var(--visible-circle-size));
    padding-left: var(--visible-circle-size);
    height: calc(2 * var(--visible-circle-size));
    width: calc(2 * var(--visible-circle-size));
    background-color: var(--ing-color);
    border-radius: 50%;
    z-index: 99999;
    transition: transform 0.3s ease-out;
  }

  .mpf-collapsed {
    transform: translate(
      calc(var(--toggle-size) - var(--visible-circle-size) / var(--root-2)),
      calc(var(--visible-circle-size) / var(--root-2) - var(--toggle-size))
    );
  }

  // Not the login screen - the panel stays mounted (it keeps the typed credentials between
  // login steps) but must not cover the banking app.
  .mpf-gone {
    display: none;
  }

  .mpf-collapsed .mpf-downleft {
    transform: rotate(270deg);
    -webkit-transform: rotate(270deg);
  }

  .mpf-wrapper {
    height: calc(var(--visible-circle-size) / var(--root-2));
    width: calc(var(--visible-circle-size) / var(--root-2));
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 0 1rem 2.5rem;
  }

  .mpf-title {
    color: #fff;
    white-space: nowrap;
    align-self: flex-start;
  }

  .mpf-input {
    margin: 0.8rem 0 !important;
  }

  .mpf-button {
    width: 50%;
    height: 2.8rem;
    background-color: #fff;
    color: #333;
    border: 1px solid var(--ing-color);

    &:hover {
      background-color: var(--ing-color);
      color: #fff;
      border: 1px solid #fff;
    }
  }

  .mpf-arrow {
    border: solid #fff;
    border-width: 0 3px 3px 0;
    display: inline-block;
    padding: 3px;
  }

  .mpf-downleft {
    transform: rotate(90deg);
    -webkit-transform: rotate(90deg);
  }

  .mpf-toggle {
    width: var(--toggle-size);
    height: var(--toggle-size);
    background-color: transparent;
    border: none;
    padding: 0;
    outline: none;
    position: relative;
    top: calc(var(--visible-circle-size) - (var(--visible-circle-size) / var(--root-2)));
    left: calc(var(--visible-circle-size) / var(--root-2) - var(--toggle-size));
  }
</style>
