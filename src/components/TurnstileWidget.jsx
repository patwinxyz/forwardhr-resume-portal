import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const TurnstileWidget = forwardRef(function TurnstileWidget(
  { siteKey, onTokenChange, onError, className = '' },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
    onErrorRef.current = onError;
  }, [onError, onTokenChange]);

  const reset = useCallback(() => {
    onTokenChangeRef.current?.('');
    if (typeof window === 'undefined' || !window.turnstile || widgetIdRef.current === null) return;
    window.turnstile.reset(widgetIdRef.current);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      reset,
    }),
    [reset]
  );

  const renderWidget = useCallback(() => {
    if (typeof window === 'undefined' || !window.turnstile) return;
    if (!containerRef.current || !siteKey || widgetIdRef.current !== null) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'light',
      callback: (token) => onTokenChangeRef.current?.(String(token || '')),
      'expired-callback': () => onTokenChangeRef.current?.(''),
      'error-callback': (errorCode) => {
        onTokenChangeRef.current?.('');
        const codeText = String(errorCode || '').trim();
        const detail = codeText ? `（${codeText}）` : '';
        onErrorRef.current?.(`機器人驗證載入失敗，請稍後再試。${detail}`);
      },
    });
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) return undefined;

    let removedListener = false;
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID);

    const handleLoad = () => {
      if (removedListener) return;
      renderWidget();
    };

    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
    } else {
      const script = document.createElement('script');
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', handleLoad, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      removedListener = true;
      if (existingScript) {
        existingScript.removeEventListener('load', handleLoad);
      }
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [renderWidget, siteKey]);

  if (!siteKey) return null;

  return (
    <div className={className}>
      <div ref={containerRef} />
    </div>
  );
});

export default TurnstileWidget;
