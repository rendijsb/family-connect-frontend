import { inject, Injectable } from '@angular/core';
import {
  ToastController,
  LoadingController,
  AlertController,
  ActionSheetController,
  ModalController,
} from '@ionic/angular';
import { FamilyRoleEnum } from '../../models/families/family.models';
import {
  RelationshipTypeEnum,
  getRelationshipLabel,
} from '../../models/families/invitation.models';

export interface AlertButton {
  text: string;
  role?: 'cancel' | 'destructive' | 'confirm';
  cssClass?: string;
  handler?: () => void | boolean | Promise<void | boolean>;
}

export interface AlertInput {
  name: string;
  type:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'tel'
    | 'url'
    | 'radio'
    | 'checkbox';
  placeholder?: string;
  value?: any;
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  id?: string;
  min?: string | number;
  max?: string | number;
  attributes?: { [key: string]: any };
}

export interface ActionSheetButton {
  text: string;
  role?: 'cancel' | 'destructive';
  icon?: string;
  cssClass?: string;
  handler?: () => void | boolean | Promise<void | boolean>;
}

export interface InviteMemberData {
  email: string;
  role: number;
  message?: string;
}

export interface RelationshipData {
  relationshipType: RelationshipTypeEnum;
  isGuardian: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);
  private readonly alertController = inject(AlertController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly modalController = inject(ModalController);

  // Toast Methods
  async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'primary' = 'success'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }

  async showToastWithDuration(
    message: string,
    duration: number = 3000,
    color: 'success' | 'danger' | 'warning' | 'primary' = 'success'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'top',
    });
    await toast.present();
  }

  // Loading Methods
  async showLoading(
    message: string = 'Please wait...'
  ): Promise<HTMLIonLoadingElement> {
    const loading = await this.loadingController.create({
      message,
      spinner: 'crescent',
    });
    await loading.present();
    return loading;
  }

  async hideLoading(): Promise<void> {
    try {
      await this.loadingController.dismiss();
    } catch (error) {
      console.log('Loading already dismissed');
    }
  }

  // Basic Alert Methods
  async showAlert(
    header: string,
    message: string,
    buttons: AlertButton[] = [{ text: 'OK', role: 'confirm' }]
  ): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons,
    });
    await alert.present();
  }

  async showAlertWithInputs(
    header: string,
    message: string,
    inputs: AlertInput[],
    buttons: AlertButton[]
  ): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      inputs,
      buttons,
    });
    await alert.present();
  }

  // Confirmation Dialogs
  async showConfirmation(
    title: string,
    message: string,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: title,
        message: message,
        buttons: [
          {
            text: cancelText,
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: confirmText,
            role: 'confirm',
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
  }

  async showDestructiveConfirmation(
    title: string,
    message: string,
    confirmText: string = 'Delete',
    cancelText: string = 'Cancel'
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: title,
        message: message,
        buttons: [
          {
            text: cancelText,
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: confirmText,
            role: 'destructive',
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
  }

  // Enhanced Family Member Invitation Modal
  async showInviteMemberModal(
    familyName: string,
    canInviteModerators: boolean = false
  ): Promise<InviteMemberData | null> {
    const { InviteMemberModal } = await import(
      '../modals/invite-member/invite-member.modal'
    );

    const modal = await this.modalController.create({
      component: InviteMemberModal,
      componentProps: {
        familyName,
        canInviteModerators,
      },
      cssClass: 'invite-member-modal',
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      return {
        email: data.email,
        role: data.role,
        message: data.message,
      };
    }

    return null;
  }

  // Legacy alert-based invitation dialog (for backward compatibility)
  async showInviteMemberDialog(): Promise<InviteMemberData | null> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Invite Family Member',
        message: 'Enter the details for the new family member invitation.',
        inputs: [
          {
            name: 'email',
            type: 'email',
            placeholder: 'Email address',
            attributes: {
              required: true,
            },
          },
          {
            name: 'role',
            type: 'radio',
            label: 'Family Member',
            value: FamilyRoleEnum.MEMBER,
            checked: true,
          },
          {
            name: 'role',
            type: 'radio',
            label: 'Family Moderator',
            value: FamilyRoleEnum.MODERATOR,
          },
          {
            name: 'message',
            type: 'text',
            placeholder: 'Personal message (optional)',
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(null),
          },
          {
            text: 'Send Invitation',
            role: 'confirm',
            handler: (data) => {
              if (!data.email?.trim()) {
                this.showToast('Please enter a valid email address.', 'danger');
                return false;
              }
              resolve({
                email: data.email.trim(),
                role: data.role,
                message: data.message?.trim() || undefined,
              });
              return true;
            },
          },
        ],
      });
      await alert.present();
    });
  }

  // Relationship Selection Modal
  async showRelationshipModal(): Promise<RelationshipData | null> {
    const { RelationshipModal } = await import(
      '../modals/relationship/relationship.modal'
    );

    const modal = await this.modalController.create({
      component: RelationshipModal,
      cssClass: 'relationship-modal',
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      return {
        relationshipType: data.relationshipType,
        isGuardian: data.isGuardian,
      };
    }

    return null;
  }

  // Legacy relationship dialog (for backward compatibility)
  async showRelationshipDialog(): Promise<RelationshipData | null> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Set Relationship',
        message: 'Define how this member is related to you.',
        inputs: [
          ...Object.values(RelationshipTypeEnum).map((type, index) => ({
            name: 'relationshipType',
            type: 'radio' as const,
            label: getRelationshipLabel(type),
            value: type,
            checked: index === 0,
          })),
          {
            name: 'isGuardian',
            type: 'checkbox' as const,
            label: 'This person is a guardian/caregiver',
            value: true,
            checked: false,
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(null),
          },
          {
            text: 'Set Relationship',
            role: 'confirm',
            handler: (data) =>
              resolve({
                relationshipType: data.relationshipType,
                isGuardian: data.isGuardian || false,
              }),
          },
        ],
      });
      await alert.present();
    });
  }

  // Role Selection Dialog
  async showRoleSelectionDialog(
    currentRole?: FamilyRoleEnum
  ): Promise<number | null> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Change Member Role',
        message: 'Select the new role for this family member.',
        inputs: [
          {
            name: 'role',
            type: 'radio',
            label:
              'Family Member - Can view and participate in family activities',
            value: FamilyRoleEnum.MEMBER,
            checked: currentRole === FamilyRoleEnum.MEMBER,
          },
          {
            name: 'role',
            type: 'radio',
            label: 'Family Moderator - Can manage members and family settings',
            value: FamilyRoleEnum.MODERATOR,
            checked: currentRole === FamilyRoleEnum.MODERATOR,
          },
          {
            name: 'role',
            type: 'radio',
            label: 'Child Member - Limited access appropriate for children',
            value: FamilyRoleEnum.CHILD,
            checked: currentRole === FamilyRoleEnum.CHILD,
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(null),
          },
          {
            text: 'Update Role',
            role: 'confirm',
            handler: (data) => resolve(data.role),
          },
        ],
      });
      await alert.present();
    });
  }

  // Join Code Input
  async showJoinCodeInput(): Promise<string | null> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Join Family',
        message: 'Enter the family join code to join an existing family.',
        cssClass: 'custom-alert',
        inputs: [
          {
            name: 'joinCode',
            type: 'text',
            placeholder: 'Enter join code',
            attributes: {
              maxlength: 8,
            },
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(null),
          },
          {
            text: 'Join',
            role: 'confirm',
            handler: (data) =>
              resolve(data.joinCode?.trim().toUpperCase() || null),
          },
        ],
      });
      await alert.present();
    });
  }

  // Delete Confirmation with Text Input
  async showDeleteConfirmation(
    itemName: string,
    itemType: string = 'item'
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: `Delete ${itemType}`,
        message: `Are you sure you want to permanently delete "${itemName}"? This action cannot be undone.`,
        inputs: [
          {
            name: 'confirmation',
            type: 'text',
            placeholder: `Type "${itemName}" to confirm`,
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: 'Delete',
            role: 'destructive',
            handler: (data) => {
              if (data.confirmation === itemName) {
                resolve(true);
              } else {
                this.showToast(
                  'Name does not match. Please try again.',
                  'danger'
                );
                resolve(false);
              }
            },
          },
        ],
      });
      await alert.present();
    });
  }

  // Action Sheets
  async showActionSheet(
    header: string,
    buttons: ActionSheetButton[]
  ): Promise<void> {
    const actionSheet = await this.actionSheetController.create({
      header,
      buttons: [
        ...buttons,
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close-outline',
        },
      ],
    });
    await actionSheet.present();
  }

  // Copy to Clipboard with Toast
  async copyToClipboard(
    text: string,
    successMessage: string = 'Copied to clipboard!'
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      await this.showToastWithDuration(successMessage, 2000, 'success');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      await this.showToast('Failed to copy to clipboard', 'danger');
    }
  }

  // Share with Fallback to Copy
  async shareWithFallback(
    shareData: ShareData,
    fallbackText: string,
    fallbackMessage: string
  ): Promise<void> {
    if (navigator.share) {
      try {
        const validShareData: ShareData = {
          title: shareData.title,
          text: shareData.text,
        };

        if (
          shareData.url &&
          (shareData.url.startsWith('http://') ||
            shareData.url.startsWith('https://'))
        ) {
          validShareData.url = shareData.url;
        }

        await navigator.share(validShareData);
      } catch (error) {
        console.error('Share failed:', error);
        await this.copyToClipboard(fallbackText, fallbackMessage);
      }
    } else {
      await this.copyToClipboard(fallbackText, fallbackMessage);
    }
  }

  async showEditNicknameDialog(
    currentNickname?: string
  ): Promise<string | null> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Edit Nickname',
        message: 'Enter a new nickname for this family member.',
        inputs: [
          {
            name: 'nickname',
            type: 'text',
            placeholder: 'Enter nickname',
            value: currentNickname || '',
            attributes: {
              maxlength: 50,
            },
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(null),
          },
          {
            text: 'Save',
            role: 'confirm',
            handler: (data) => resolve(data.nickname?.trim() || null),
          },
        ],
      });
      await alert.present();
    });
  }

  async showExpiryWarning(expiresIn: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Invitation Expiring Soon',
        message: `This invitation expires ${expiresIn}. Would you like to accept it now?`,
        buttons: [
          {
            text: 'Not Now',
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: 'Accept Now',
            role: 'confirm',
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
  }

  async showEditMemberModal(member: any): Promise<any | null> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Edit Member',
        message: `Update information for ${member.user?.name || 'this member'}`,
        cssClass: 'custom-alert',
        inputs: [
          {
            name: 'nickname',
            type: 'text',
            placeholder: 'Nickname',
            value: member.nickname || '',
          },
          {
            name: 'phone',
            type: 'tel',
            placeholder: 'Phone Number',
            value: member.phone || '',
          },
          {
            name: 'birthday',
            type: 'date',
            placeholder: 'Birthday',
            value: member.birthday || '',
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(null),
          },
          {
            text: 'Update',
            role: 'confirm',
            handler: (data: any): any => {
              if (
                !data.nickname?.trim() &&
                !data.phone?.trim() &&
                !data.birthday
              ) {
                return false; // Prevent close if no data entered
              }
              resolve({
                nickname: data.nickname?.trim() || null,
                phone: data.phone?.trim() || null,
                birthday: data.birthday || null,
                notificationsEnabled: true, // You could add this as a checkbox if needed
              });
            },
          },
        ],
      });
      await alert.present();
    });
  }
}
