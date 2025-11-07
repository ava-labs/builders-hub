'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function DocsNavbarToggle() {
  const pathname = usePathname();

  useEffect(() => {
      // Only show on docs/academy pages and mobile
      const checkAndInject = () => {
        const isMobile = window.innerWidth <= 1023;
        const isDocsPage = pathname.startsWith('/docs');
        const isAcademyPage = pathname.startsWith('/academy');
      
        if ((!isDocsPage && !isAcademyPage) || !isMobile) {
          // Remove button if conditions don't match
          const existingButton = document.querySelector('[data-docs-sidebar-toggle]');
          if (existingButton) {
            existingButton.remove();
          }
          return;
        }
        
        // Add data attribute to body for CSS targeting (hide dropdown on acps pages only)
        const shouldHideDropdown = pathname.startsWith('/docs/acps');
        if (shouldHideDropdown) {
          document.body.setAttribute('data-hide-sidebar-dropdown', 'true');
        } else {
          document.body.removeAttribute('data-hide-sidebar-dropdown');
        }

      const navbar = document.querySelector('nav[aria-label="Main"]') || document.querySelector('header[aria-label="Main"]');
      if (!navbar) return;

      // Check if button already exists
      const existingButton = navbar.querySelector('[data-docs-sidebar-toggle]');
      if (existingButton) {
        return;
      }

      // Find the main navbar container (the nav element itself contains the items)
      const navContainer = navbar.querySelector('nav') || navbar;
      if (!navContainer) return;

      // Create the toggle button
      const toggleButton = document.createElement('button');
      toggleButton.setAttribute('data-docs-sidebar-toggle', 'true');
      toggleButton.setAttribute('aria-label', isAcademyPage ? 'Toggle academy sidebar' : 'Toggle docs sidebar');
      toggleButton.setAttribute('type', 'button');
      toggleButton.className = 'flex items-center justify-center w-10 h-10 rounded-md border border-border hover:bg-accent transition-colors shrink-0 mr-3';
      toggleButton.style.cursor = 'pointer';
      toggleButton.style.pointerEvents = 'auto';
      
      // Use React icon or create SVG
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'h-5 w-5');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('viewBox', '0 0 24 24');
      
      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('stroke-linecap', 'round');
      path1.setAttribute('stroke-linejoin', 'round');
      path1.setAttribute('stroke-width', '2');
      path1.setAttribute('d', 'M4 6h16');
      
      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path2.setAttribute('stroke-linecap', 'round');
      path2.setAttribute('stroke-linejoin', 'round');
      path2.setAttribute('stroke-width', '2');
      path2.setAttribute('d', 'M4 12h16');
      
      const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path3.setAttribute('stroke-linecap', 'round');
      path3.setAttribute('stroke-linejoin', 'round');
      path3.setAttribute('stroke-width', '2');
      path3.setAttribute('d', 'M4 18h16');
      
      svg.appendChild(path1);
      svg.appendChild(path2);
      svg.appendChild(path3);
      toggleButton.appendChild(svg);
      
      toggleButton.addEventListener('click', (e) => {
        // Prevent navigation and bubbling
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Prevent any click-outside handlers from closing the sidebar immediately
        let preventClose = true;
        const preventClickOutside = (event: MouseEvent) => {
          // Only prevent clicks on the overlay, not on our button
          const target = event.target as HTMLElement;
          if (preventClose && target?.hasAttribute('data-radix-dialog-overlay')) {
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        };
        
        // Add click handler to prevent closing AFTER sidebar opens
        setTimeout(() => {
          document.addEventListener('click', preventClickOutside, { capture: true });
          
          // Remove the prevention after sidebar should be open
          setTimeout(() => {
            preventClose = false;
            setTimeout(() => {
              document.removeEventListener('click', preventClickOutside, { capture: true });
            }, 100);
          }, 300);
        }, 50);
        
        // Use a timeout to prevent immediate click-outside handlers from closing it
        setTimeout(() => {
          // Find the Sheet component and sidebar toggle button
          const sheet = document.querySelector('[data-sidebar="sidebar"][data-mobile="true"]') as HTMLElement;
          const sidebarToggleButton = document.querySelector('button[aria-label*="sidebar" i]:not([data-docs-sidebar-toggle]), button[aria-label*="Open Sidebar" i]:not([data-docs-sidebar-toggle])') as HTMLButtonElement;
          
          if (sidebarToggleButton) {
            
            // Make sure it's visible and clickable - remove all restrictions
            const originalStyles = {
              display: sidebarToggleButton.style.display,
              visibility: sidebarToggleButton.style.visibility,
              opacity: sidebarToggleButton.style.opacity,
              pointerEvents: sidebarToggleButton.style.pointerEvents,
              position: sidebarToggleButton.style.position,
              left: sidebarToggleButton.style.left,
              top: sidebarToggleButton.style.top,
            };
            
            // Fully enable the button
            sidebarToggleButton.style.display = 'flex';
            sidebarToggleButton.style.visibility = 'visible';
            sidebarToggleButton.style.opacity = '1';
            sidebarToggleButton.style.pointerEvents = 'auto';
            sidebarToggleButton.style.position = 'static';
            sidebarToggleButton.removeAttribute('disabled');
            sidebarToggleButton.setAttribute('tabindex', '0');
            
            // Focus the button first
            sidebarToggleButton.focus();
            
            // Disable overlay clicks temporarily
            const overlay = document.querySelector('[data-radix-dialog-overlay]') as HTMLElement;
            if (overlay) {
              overlay.style.pointerEvents = 'none';
            } else {
              // Wait for overlay to be created and disable it
              const observer = new MutationObserver((mutations) => {
                const newOverlay = document.querySelector('[data-radix-dialog-overlay]') as HTMLElement;
                if (newOverlay) {
                  newOverlay.style.pointerEvents = 'none';
                  // Re-enable after a delay
                  setTimeout(() => {
                    newOverlay.style.pointerEvents = 'auto';
                  }, 300);
                  observer.disconnect();
                }
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true,
              });
              
              // Stop observing after 1 second
              setTimeout(() => observer.disconnect(), 1000);
            }
            
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
              // Method 1: Direct click (most reliable)
              try {
                // First ensure button is fully enabled
                sidebarToggleButton.style.pointerEvents = 'auto';
                sidebarToggleButton.disabled = false;
                
                // Add a capture-phase handler to prevent navigation AFTER the click
                const preventNavigation = (e: Event) => {
                  // Only prevent if it's a link click that would navigate
                  const target = e.target as HTMLElement;
                  const link = target.closest('a');
                  if (link && link.href && !link.href.includes('#')) {
                    // Check if this link is inside our button or sidebar toggle
                    const ourButton = document.querySelector('[data-docs-sidebar-toggle]');
                    if (
                      (ourButton && ourButton.contains(link)) ||
                      sidebarToggleButton.contains(link)
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }
                };
                
                // Add handler AFTER we click
                setTimeout(() => {
                  document.addEventListener('click', preventNavigation, { capture: true });
                  
                  // Remove after sidebar should be open
                  setTimeout(() => {
                    document.removeEventListener('click', preventNavigation, { capture: true });
                  }, 300);
                }, 50);
                
                // Click it - this should trigger React handlers
                sidebarToggleButton.click();
              } catch (e) {
                console.error('Click error:', e);
              }
              
              // Method 2: MouseEvent that bubbles but doesn't navigate
              setTimeout(() => {
                try {
                  const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 0,
                    detail: 1,
                    buttons: 1,
                  });
                  
                  // Prevent default on the event
                  Object.defineProperty(clickEvent, 'defaultPrevented', { value: false, writable: true });
                  
                  // Add a one-time handler to prevent navigation
                  const preventNav = (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                  };
                  sidebarToggleButton.addEventListener('click', preventNav, { once: true, capture: true });
                  
                  sidebarToggleButton.dispatchEvent(clickEvent);
                } catch (e) {
                  console.error('MouseEvent error:', e);
                }
              }, 20);
              
              // Restore styles after sidebar should be open
              setTimeout(() => {
                // Restore styles after a delay
                setTimeout(() => {
                  Object.assign(sidebarToggleButton.style, originalStyles);
                  // Re-enable overlay after sidebar should be open
                  if (overlay) {
                    setTimeout(() => {
                      overlay.style.pointerEvents = 'auto';
                    }, 200);
                  }
                }, 100);
              }, 200);
            });
            
            return;
          }
          
          // Method 3: Try to find buttons in the notebook layout
          const notebookButtons = document.querySelectorAll('.nd-layout-notebook button:not([data-docs-sidebar-toggle]):not([aria-haspopup]):not([role="combobox"])');
          
          if (notebookButtons.length > 0) {
            const firstButton = notebookButtons[0] as HTMLButtonElement;
            
            // Try direct click
            firstButton.click();
            
            // Also try MouseEvent
            setTimeout(() => {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0,
              });
              firstButton.dispatchEvent(clickEvent);
            }, 10);
            
            return;
          }
          
          // Method 4: Try to find any button that might be the sidebar toggle
          const selectors = [
            '.nd-layout-notebook > div:first-child > button:not([aria-haspopup]):not([role="combobox"]):not([data-docs-sidebar-toggle])',
            '[data-sidebar-trigger]:not([data-docs-sidebar-toggle])',
            '[data-sidebar="trigger"]:not([data-docs-sidebar-toggle])',
            'button[aria-label*="menu" i]:not([data-docs-sidebar-toggle])',
          ];
          
          for (const selector of selectors) {
            const button = document.querySelector(selector) as HTMLButtonElement;
            if (button && button !== toggleButton) {
              // Try direct click
              button.click();
              
              // Also try MouseEvent
              setTimeout(() => {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  button: 0,
                });
                button.dispatchEvent(clickEvent);
              }, 10);
              
              break;
            }
          }
        }, 50);
      }, { capture: true });

      // Insert as the first child of the navbar (before the logo)
      const firstChild = navContainer.firstChild;
      if (firstChild) {
        navContainer.insertBefore(toggleButton, firstChild);
      } else {
        navContainer.appendChild(toggleButton);
      }
    };

    // Check immediately and on resize
    checkAndInject();
    const resizeHandler = () => checkAndInject();
    window.addEventListener('resize', resizeHandler);

    // Also check after a delay to catch dynamically rendered elements
    const timeout = setTimeout(checkAndInject, 100);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      clearTimeout(timeout);
      const btn = document.querySelector('[data-docs-sidebar-toggle]');
      if (btn) {
        btn.remove();
      }
    };
  }, [pathname]);

  return null;
}

