import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonButtons,
  IonIcon,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, chatbubbleOutline } from 'ionicons/icons';

import { FamilyService } from '../../../core/services/family/family.service';
import { FamilyMemberService } from '../../../core/services/family-member/family-member.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Family, FamilyMember } from '../../../models/families/family.models';
import { CreateChatRoomModal } from './create-chat-room.modal';

@Component({
  selector: 'app-create-chat-room-page',
  templateUrl: './create-chat-room.page.html',
  styleUrls: ['./create-chat-room.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonButtons,
    IonIcon,
  ],
})
export class CreateChatRoomPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly modalController = inject(ModalController);
  private readonly familyService = inject(FamilyService);
  private readonly memberService = inject(FamilyMemberService);
  private readonly toastService = inject(ToastService);

  readonly family = signal<Family | null>(null);
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly familySlug = signal<string>('');
  readonly isLoading = signal<boolean>(false);

  constructor() {
    this.addIcons();
  }

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.familySlug.set(slug);

    if (slug) {
      this.loadFamilyAndMembers();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      arrowBackOutline,
      chatbubbleOutline,
    });
  }

  private loadFamilyAndMembers() {
    this.isLoading.set(true);

    combineLatest([
      this.familyService.getFamilyBySlug(this.familySlug()),
      this.memberService.getFamilyMembers(this.familySlug()),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([familyResponse, membersResponse]) => {
          this.family.set(familyResponse.data);
          this.familyMembers.set(membersResponse.data);
          this.isLoading.set(false);
          // Auto-open the modal once data is loaded
          this.openCreateModal();
        },
        error: (error) => {
          console.error('Load family members error:', error);
          this.toastService.showToast(
            'Failed to load family members.',
            'danger'
          );
          this.isLoading.set(false);
          // Navigate back on error
          this.goBack();
        },
      });
  }

  private async openCreateModal() {
    const modal = await this.modalController.create({
      component: CreateChatRoomModal,
      componentProps: {
        family: this.family(),
        familyMembers: this.familyMembers(),
      },
      cssClass: 'create-room-modal',
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();

    // Navigate back to chat list regardless of outcome
    await this.goBack();

    if (data?.created) {
      this.toastService.showToast('Chat room created successfully!', 'success');
    }
  }

  async goBack() {
    await this.router.navigate(['/family', this.familySlug(), 'chat']);
  }
}
