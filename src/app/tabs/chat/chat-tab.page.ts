import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent,
  IonButton, IonIcon, IonButtons, IonRefresher, IonRefresherContent,
  IonFab, IonFabButton, IonSkeletonText, IonAvatar, IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleOutline, addOutline, peopleOutline, personOutline,
  megaphoneOutline, warningOutline, timeOutline, checkmarkDoneOutline,
  ellipsisVerticalOutline
} from 'ionicons/icons';

import { ChatService } from '../../core/services/chat/chat.service';
import { FamilyService } from '../../core/services/family/family.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import {
  ChatRoom,
  getChatRoomTypeIcon,
  getChatRoomTypeName,
  formatMessageTime
} from '../../models/chat/chat.models';
import { Family } from '../../models/families/family.models';

@Component({
  selector: 'app-chat-tab',
  templateUrl: './chat-tab.page.html',
  styleUrls: ['./chat-tab.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent,
    IonButton, IonIcon, IonButtons, IonRefresher, IonRefresherContent,
    IonFab, IonFabButton, IonSkeletonText, IonAvatar, IonBadge
  ]
})
export class ChatTabPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly familyService = inject(FamilyService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly allChatRooms = signal<{ family: Family; rooms: ChatRoom[] }[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly totalUnreadCount = this.chatService.totalUnreadCount;

  constructor() {
    this.addIcons();
  }

  ngOnInit() {
    this.loadAllChatRooms();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      chatbubbleOutline, addOutline, peopleOutline, personOutline,
      megaphoneOutline, warningOutline, timeOutline, checkmarkDoneOutline,
      ellipsisVerticalOutline
    });
  }

  private loadAllChatRooms() {
    this.isLoading.set(true);

    // Get all families first
    this.familyService.families$
      .pipe(takeUntil(this.destroy$))
      .subscribe(families => {
        if (families.length === 0) {
          // Load families if not already loaded
          this.familyService.getMyFamilies()
            .pipe(takeUntil(this.destroy$))
            .subscribe();
        } else {
          // Load chat rooms for each family
          this.loadChatRoomsForFamilies(families);
        }
      });
  }

  private async loadChatRoomsForFamilies(families: Family[]) {
    const familyChatRooms: { family: Family; rooms: ChatRoom[] }[] = [];

    for (const family of families) {
      try {
        const response = await this.chatService.getChatRooms(family.slug).toPromise();
        if (response) {
          familyChatRooms.push({
            family,
            rooms: response.data
          });
        }
      } catch (error) {
        console.error(`Failed to load chat rooms for ${family.name}:`, error);
      }
    }

    this.allChatRooms.set(familyChatRooms);
    this.isLoading.set(false);
  }

  doRefresh(event: any) {
    this.loadAllChatRooms();
    setTimeout(() => event.target.complete(), 1000);
  }

  async openChatRoom(family: Family, room: ChatRoom) {
    await this.router.navigate(['/family', family.slug, 'chat', room.id]);
  }

  async openFamilyChat(family: Family, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    await this.router.navigate(['/family', family.slug, 'chat']);
  }

  async createChatRoom() {
    const families = this.familyService.getFamilies();

    if (families.length === 0) {
      await this.toastService.showToast('No families available. Create or join a family first.', 'warning');
      return;
    }

    if (families.length === 1) {
      // Navigate directly to create room for single family
      await this.router.navigate(['/family', families[0].slug, 'chat', 'create']);
    } else {
      // Show family selection for multiple families
      await this.presentFamilySelection(families);
    }
  }

  private async presentFamilySelection(families: Family[]) {
    const buttons = families.map(family => ({
      text: family.name,
      icon: 'home-outline',
      handler: async () => {
        await this.router.navigate(['/family', family.slug, 'chat', 'create']);
      }
    }));

    await this.toastService.showActionSheet('Select Family', buttons);
  }

  getChatRoomTypeIcon(type: string): string {
    return getChatRoomTypeIcon(type as any);
  }

  getChatRoomTypeName(type: string): string {
    return getChatRoomTypeName(type as any);
  }

  formatMessageTime(dateString: string): string {
    return formatMessageTime(dateString);
  }

  getLastMessagePreview(room: ChatRoom): string {
    if (!room.lastMessage) {
      return 'No messages yet';
    }

    const message = room.lastMessage;

    if (message.isDeleted) {
      return 'Message deleted';
    }

    if (message.type !== 'text') {
      switch (message.type) {
        case 'image': return '📷 Photo';
        case 'video': return '🎥 Video';
        case 'audio': return '🎵 Audio';
        case 'file': return '📎 File';
        case 'location': return '📍 Location';
        case 'poll': return '📊 Poll';
        case 'event': return '📅 Event';
        default: return 'Message';
      }
    }

    return message.message.length > 50
      ? message.message.substring(0, 50) + '...'
      : message.message;
  }

  getLastMessageSender(room: ChatRoom): string {
    if (!room.lastMessage?.user) {
      return '';
    }

    const currentUser = this.authService.user();
    const sender = room.lastMessage.user;

    if (sender.id === currentUser?.id) {
      return 'You: ';
    }

    return `${sender.name}: `;
  }

  getTotalUnreadForFamily(rooms: ChatRoom[]): number {
    return rooms.reduce((total, room) => total + (room.unreadCount || 0), 0);
  }

  trackByFamilyId(index: number, item: { family: Family; rooms: ChatRoom[] }): number {
    return item.family.id;
  }

  trackByRoomId(index: number, room: ChatRoom): number {
    return room.id;
  }
}
