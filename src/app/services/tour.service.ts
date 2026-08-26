import { Injectable, inject } from '@angular/core';
import { driver, Driver } from 'driver.js';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TourService {
    private authService = inject(AuthService);
    private driverObj: Driver | null = null;
    private completed = false;

    startTour(): void {
        this.run([
            {
                element: '.sidebar-tab-bar',
                popover: {
                    title: 'Quick actions',
                    description: 'Quick actions regarding boards and jobs assigned to you starred items, recent activity, your tasks, due dates, invitations, and your scratchpad, all one click away.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#tour-ws-kebab',
                popover: {
                    title: 'Workspace options',
                    description: 'Leave, invite members to, or edit this workspace from here.',
                    side: 'bottom',
                    align: 'end'
                }
            },
            {
                element: '.btn-expand',
                popover: {
                    title: 'Expand board',
                    description: 'View the board and its cards in detail.',
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '.icon-btn--logout',
                popover: {
                    title: 'Log out',
                    description: 'This is logout.',
                    side: 'bottom',
                    align: 'end'
                }
            }
        ]);
    }

    startEmptyStateTour(): void {
        this.run([
            {
                element: '#tour-empty-create-btn',
                popover: {
                    title: 'Create your first workspace',
                    description: 'Start here create a workspace, then invite your team to collaborate on boards together.',
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '.sidebar-tab-bar',
                popover: {
                    title: 'Quick actions',
                    description: 'Quick actions regarding boards and jobs assigned to you starred items, recent activity, your tasks, due dates, invitations, and your scratchpad, all one click away.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '.icon-btn--logout',
                popover: {
                    title: 'Log out',
                    description: 'This is logout.',
                    side: 'bottom',
                    align: 'end'
                }
            }
        ]);
    }

    private run(steps: any[]): void {
        this.completed = false;

        this.driverObj = driver({
            showProgress: true,
            allowClose: true,
            onCloseClick: () => {
                this.driverObj?.destroy();
                this.completeOnboarding();
            },
            onDestroyed: () => {
                this.completeOnboarding();
            },
            steps
        });

        this.driverObj.drive();
    }

    private completeOnboarding(): void {
        if (this.completed) return;
        this.completed = true;
        this.authService.markOnboardingComplete();
    }
}