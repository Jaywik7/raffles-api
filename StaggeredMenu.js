import React, { useCallback, useLayoutEffect, useRef, useState } from 'https://esm.sh/react@18';
import { gsap } from 'https://esm.sh/gsap@3';

export const StaggeredMenu = ({
  position = 'right',
  colors = ['#B19EEF', '#5227FF'],
  items = [],
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = true,
  className,
  logoUrl = './assets/logo.svg',
  logoOppositeUrl = './assets/logo-opposite.svg',
  menuButtonColor = '#fff',
  openMenuButtonColor = '#fff',
  accentColor = '#5227FF',
  changeMenuColorOnOpen = true,
  isFixed = true,
  onMenuOpen,
  onMenuClose
}) => {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const panelRef = useRef(null);
  const preLayersRef = useRef(null);
  const preLayerElsRef = useRef([]);
  const plusHRef = useRef(null);
  const plusVRef = useRef(null);
  const iconRef = useRef(null);
  const textInnerRef = useRef(null);
  const textWrapRef = useRef(null);
  const [textLines, setTextLines] = useState(['Menu', 'Close']);

  const openTlRef = useRef(null);
  const closeTweenRef = useRef(null);
  const spinTweenRef = useRef(null);
  const textCycleAnimRef = useRef(null);
  const colorTweenRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const busyRef = useRef(false);
  const itemEntranceTweenRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;
      if (!panel || !plusH || !plusV || !icon || !textInner) return;

      let preLayers = [];
      if (preContainer) {
        preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer'));
      }
      preLayerElsRef.current = preLayers;

      const offscreen = position === 'left' ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen });
      gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
      gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
      gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
      gsap.set(textInner, { yPercent: 0 });
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { color: menuButtonColor });
    });
    return () => ctx.revert();
  }, [menuButtonColor, position]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    if (closeTweenRef.current) {
      closeTweenRef.current.kill();
      closeTweenRef.current = null;
    }
    itemEntranceTweenRef.current?.kill();

    const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
    const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
    const socialTitle = panel.querySelector('.sm-socials-title');
    const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link'));

    const layerStates = layers.map(el => ({ el, start: Number(gsap.getProperty(el, 'xPercent')) }));
    const panelStart = Number(gsap.getProperty(panel, 'xPercent'));

    if (itemEls.length) {
      gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    }
    if (numberEls.length) {
      gsap.set(numberEls, { '--sm-num-opacity': 0 });
    }
    if (socialTitle) {
      gsap.set(socialTitle, { opacity: 0 });
    }
    if (socialLinks.length) {
      gsap.set(socialLinks, { y: 25, opacity: 0 });
    }

    const tl = gsap.timeline({ paused: true });

    layerStates.forEach((ls, i) => {
      tl.fromTo(ls.el, { xPercent: ls.start }, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07);
    });
    const lastTime = layerStates.length ? (layerStates.length - 1) * 0.07 : 0;
    const panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0);
    const panelDuration = 0.65;
    tl.fromTo(
      panel,
      { xPercent: panelStart },
      { xPercent: 0, duration: panelDuration, ease: 'power4.out' },
      panelInsertTime
    );

    if (itemEls.length) {
      const itemsStartRatio = 0.15;
      const itemsStart = panelInsertTime + panelDuration * itemsStartRatio;
      tl.to(
        itemEls,
        {
          yPercent: 0,
          rotate: 0,
          duration: 1,
          ease: 'power4.out',
          stagger: { each: 0.1, from: 'start' }
        },
        itemsStart
      );
      if (numberEls.length) {
        tl.to(
          numberEls,
          {
            duration: 0.6,
            ease: 'power2.out',
            '--sm-num-opacity': 1,
            stagger: { each: 0.08, from: 'start' }
          },
          itemsStart + 0.1
        );
      }
    }

    if (socialTitle || socialLinks.length) {
      const socialsStart = panelInsertTime + panelDuration * 0.4;
      if (socialTitle) {
        tl.to(
          socialTitle,
          {
            opacity: 1,
            duration: 0.5,
            ease: 'power2.out'
          },
          socialsStart
        );
      }
      if (socialLinks.length) {
        tl.to(
          socialLinks,
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            ease: 'power3.out',
            stagger: { each: 0.08, from: 'start' },
            onComplete: () => {
              gsap.set(socialLinks, { clearProps: 'opacity' });
            }
          },
          socialsStart + 0.04
        );
      }
    }

    openTlRef.current = tl;
    return tl;
  }, []);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback('onComplete', () => {
        busyRef.current = false;
      });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;
    itemEntranceTweenRef.current?.kill();

    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;

    const all = [...layers, panel];
    closeTweenRef.current?.kill();
    const offscreen = position === 'left' ? -100 : 100;
    closeTweenRef.current = gsap.to(all, {
      xPercent: offscreen,
      duration: 0.32,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
        if (itemEls.length) {
          gsap.set(itemEls, { yPercent: 140, rotate: 10 });
        }
        const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
        if (numberEls.length) {
          gsap.set(numberEls, { '--sm-num-opacity': 0 });
        }
        const socialTitle = panel.querySelector('.sm-socials-title');
        const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link'));
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
        busyRef.current = false;
      }
    });
  }, [position]);

  const animateIcon = useCallback(opening => {
    const icon = iconRef.current;
    if (!icon) return;
    spinTweenRef.current?.kill();
    if (opening) {
      spinTweenRef.current = gsap.to(icon, { rotate: 225, duration: 0.8, ease: 'power4.out', overwrite: 'auto' });
    } else {
      spinTweenRef.current = gsap.to(icon, { rotate: 0, duration: 0.35, ease: 'power3.inOut', overwrite: 'auto' });
    }
  }, []);

  const animateColor = useCallback(
    opening => {
      const btn = toggleBtnRef.current;
      if (!btn) return;
      colorTweenRef.current?.kill();
      if (changeMenuColorOnOpen) {
        const targetColor = opening ? openMenuButtonColor : menuButtonColor;
        colorTweenRef.current = gsap.to(btn, {
          color: targetColor,
          delay: 0.18,
          duration: 0.3,
          ease: 'power2.out'
        });
      } else {
        gsap.set(btn, { color: menuButtonColor });
      }
    },
    [openMenuButtonColor, menuButtonColor, changeMenuColorOnOpen]
  );

  React.useEffect(() => {
    if (toggleBtnRef.current) {
      if (changeMenuColorOnOpen) {
        const targetColor = openRef.current ? openMenuButtonColor : menuButtonColor;
        gsap.set(toggleBtnRef.current, { color: targetColor });
      } else {
        gsap.set(toggleBtnRef.current, { color: menuButtonColor });
      }
    }
  }, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor]);

  const animateText = useCallback(opening => {
    const inner = textInnerRef.current;
    if (!inner) return;
    textCycleAnimRef.current?.kill();

    const currentLabel = opening ? 'Menu' : 'Close';
    const targetLabel = opening ? 'Close' : 'Menu';
    const cycles = 3;
    const seq = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < cycles; i++) {
      last = last === 'Menu' ? 'Close' : 'Menu';
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);
    setTextLines(seq);

    gsap.set(inner, { yPercent: 0 });
    const lineCount = seq.length;
    const finalShift = ((lineCount - 1) / lineCount) * 100;
    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.5 + lineCount * 0.07,
      ease: 'power4.out'
    });
  }, []);

  const toggleMenu = useCallback(() => {
    const target = !openRef.current;
    openRef.current = target;
    setOpen(target);
    if (target) {
      onMenuOpen?.();
      playOpen();
    } else {
      onMenuClose?.();
      playClose();
    }
    animateIcon(target);
    animateColor(target);
    animateText(target);
  }, [playOpen, playClose, animateIcon, animateColor, animateText, onMenuOpen, onMenuClose]);

  const closeMenu = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    onMenuClose?.();
    playClose();
    animateIcon(false);
    animateColor(false);
    animateText(false);
  }, [playClose, animateIcon, animateColor, animateText, onMenuClose]);

  return (
    React.createElement('div',
      {
        className: (className ? className + ' ' : '') + 'staggered-menu-wrapper' + (isFixed ? ' fixed-wrapper' : ''),
        style: accentColor ? { ['--sm-accent']: accentColor } : undefined,
        'data-position': position,
        'data-open': open || undefined
      },
      React.createElement('div', { ref: preLayersRef, className: 'sm-prelayers', 'aria-hidden': 'true' },
        (() => {
          const raw = colors && colors.length
            ? colors.slice(0, 5)
            : ['#FFC0F5', '#00E3FA', '#5CFCA9', '#FFD55F', '#FF9161'];
          return raw.map((c, i) => React.createElement('div', { key: i, className: 'sm-prelayer', style: { background: c } }));
        })()
      ),
      React.createElement('header', { className: 'staggered-menu-header', 'aria-label': 'Main navigation header' },
        React.createElement('div', { className: 'sm-logo', 'aria-label': 'Logo' },
          React.createElement('img', {
            src: logoUrl || './assets/favicon.ico',
            alt: 'Logo',
            className: 'sm-logo-img sm-logo-default',
            draggable: false,
            width: 110,
            height: 24
          }),
          React.createElement('img', {
            src: logoOppositeUrl || './assets/logo-opposite.svg',
            alt: 'Logo',
            className: 'sm-logo-img sm-logo-opposite',
            draggable: false,
            width: 110,
            height: 24
          })
        ),
        React.createElement('button', {
          ref: toggleBtnRef,
          className: 'sm-toggle',
          'aria-label': open ? 'Close menu' : 'Open menu',
          'aria-expanded': open,
          'aria-controls': 'staggered-menu-panel',
          onClick: toggleMenu,
          type: 'button'
        },
          React.createElement('span', { ref: textWrapRef, className: 'sm-toggle-textWrap', 'aria-hidden': 'true' },
            React.createElement('span', { ref: textInnerRef, className: 'sm-toggle-textInner' },
              textLines.map((l, i) => React.createElement('span', { className: 'sm-toggle-line', key: i }, l))
            )
          ),
          React.createElement('span', { ref: iconRef, className: 'sm-icon', 'aria-hidden': 'true' },
            React.createElement('span', { ref: plusHRef, className: 'sm-icon-line' }),
            React.createElement('span', { ref: plusVRef, className: 'sm-icon-line sm-icon-line-v' })
          )
        )
      ),
      React.createElement('aside', { id: 'staggered-menu-panel', ref: panelRef, className: 'staggered-menu-panel', 'aria-hidden': !open },
        React.createElement('div', { className: 'sm-panel-inner' },
          React.createElement('ul', { className: 'sm-panel-list', role: 'list', 'data-numbering': displayItemNumbering || undefined },
            items && items.length
              ? items.map((it, idx) => {
                  const isDisabled = it.disabled || !it.link;
                  const handleClick = (e) => {
                    // Always close menu on any item selection (even disabled),
                    // so the menu doesn't stay open after tapping on mobile.
                    closeMenu();
                    if (isDisabled) {
                      e.preventDefault();
                    }
                  };
                  return React.createElement('li', { className: 'sm-panel-itemWrap', key: it.label + idx },
                    React.createElement('a', {
                      className: 'sm-panel-item',
                      href: it.link || '#',
                      'aria-label': it.ariaLabel,
                      'data-index': idx + 1,
                      'aria-disabled': isDisabled ? 'true' : undefined,
                      onClick: handleClick
                    },
                      React.createElement('span', { className: 'sm-panel-itemLabel' }, it.label)
                    )
                  );
                })
              : React.createElement('li', { className: 'sm-panel-itemWrap', 'aria-hidden': 'true' },
                  React.createElement('span', { className: 'sm-panel-item' },
                    React.createElement('span', { className: 'sm-panel-itemLabel' }, 'No items')
                  )
                )
          ),
          displaySocials && socialItems && socialItems.length > 0 &&
            React.createElement('div', { className: 'sm-socials', 'aria-label': 'Social links' },
              React.createElement('h3', { className: 'sm-socials-title' }, 'Socials'),
              React.createElement('ul', { className: 'sm-socials-list', role: 'list' },
                socialItems.map((s, i) =>
                  React.createElement('li', { key: s.label + i, className: 'sm-socials-item' },
                    React.createElement('a', {
                      href: s.link,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className: 'sm-socials-link',
                      onClick: () => closeMenu()
                    },
                      React.createElement('span', { className: 'sm-socials-icon', 'aria-hidden': 'true' },
                        s.label && String(s.label).toLowerCase().includes('discord')
                          ? React.createElement('img', { src: './assets/discordlogo.png', alt: '', draggable: false })
                          : React.createElement('img', { src: './assets/xlogo.webp', alt: '', draggable: false })
                      ),
                      React.createElement('span', { className: 'sr-only' }, s.label)
                    )
                  )
                )
              )
            )
        )
      )
    )
  );
};

export default StaggeredMenu;


