import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, peopleOutline, chatbubbleOutline, cameraOutline, personOutline } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';

// TODO: Import chat service when implemented
// import { ChatService } from '../core/services/chat/chat.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: true,
  imports: [CommonModule, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel]
})
export class TabsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // TODO: Inject chat service when implemented
  // private readonly chatService = inject(ChatService);

  unreadMessages = 0;

  constructor() {
    addIcons({ homeOutline, peopleOutline, chatbubbleOutline, cameraOutline, personOutline });
  }

  ngOnInit() {
    // TODO: Subscribe to unread messages when chat service is implemented
    // this.chatService.unreadCount$
    //   .pipe(takeUntil(this.destroy$))
    //   .subscribe(count => {
    //     this.unreadMessages = count;
    //   });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
