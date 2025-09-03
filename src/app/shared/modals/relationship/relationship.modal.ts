import { Component, OnInit, inject, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonItem, IonLabel, IonCheckbox, IonModal, IonList
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline, peopleOutline, heartOutline, checkmarkOutline,
  shieldCheckmarkOutline
} from 'ionicons/icons';

import { ModalController } from '@ionic/angular';
import {
  RelationshipTypeEnum,
  getRelationshipLabel
} from '../../../models/families/invitation.models';

export interface RelationshipResult {
  relationshipType: RelationshipTypeEnum;
  isGuardian: boolean;
}

@Component({
  selector: 'app-relationship-modal',
  templateUrl: './relationship.modal.html',
  styleUrls: ['./relationship.modal.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonItem, IonLabel, IonCheckbox, IonModal, IonList
  ]
})
export class RelationshipModal implements OnInit {
  @Input() memberName: string = 'this member';
  @Input() currentRelationship?: RelationshipTypeEnum;
  @Input() currentIsGuardian: boolean = false;

  private readonly formBuilder = inject(FormBuilder);
  private readonly modalController = inject(ModalController);

  relationshipForm!: FormGroup;
  readonly RelationshipTypeEnum = RelationshipTypeEnum;

  readonly relationshipOptions = [
    {
      value: RelationshipTypeEnum.PARENT,
      label: getRelationshipLabel(RelationshipTypeEnum.PARENT),
      icon: 'people-outline',
      description: 'A parent or parental figure'
    },
    {
      value: RelationshipTypeEnum.CHILD,
      label: getRelationshipLabel(RelationshipTypeEnum.CHILD),
      icon: 'heart-outline',
      description: 'A child or dependent'
    },
    {
      value: RelationshipTypeEnum.SPOUSE,
      label: getRelationshipLabel(RelationshipTypeEnum.SPOUSE),
      icon: 'heart-outline',
      description: 'A spouse or partner'
    },
    {
      value: RelationshipTypeEnum.SIBLING,
      label: getRelationshipLabel(RelationshipTypeEnum.SIBLING),
      icon: 'people-outline',
      description: 'A brother or sister'
    },
    {
      value: RelationshipTypeEnum.GRANDPARENT,
      label: getRelationshipLabel(RelationshipTypeEnum.GRANDPARENT),
      icon: 'people-outline',
      description: 'A grandparent'
    },
    {
      value: RelationshipTypeEnum.GRANDCHILD,
      label: getRelationshipLabel(RelationshipTypeEnum.GRANDCHILD),
      icon: 'heart-outline',
      description: 'A grandchild'
    },
    {
      value: RelationshipTypeEnum.AUNT_UNCLE,
      label: getRelationshipLabel(RelationshipTypeEnum.AUNT_UNCLE),
      icon: 'people-outline',
      description: 'An aunt or uncle'
    },
    {
      value: RelationshipTypeEnum.NEPHEW_NIECE,
      label: getRelationshipLabel(RelationshipTypeEnum.NEPHEW_NIECE),
      icon: 'heart-outline',
      description: 'A nephew or niece'
    },
    {
      value: RelationshipTypeEnum.COUSIN,
      label: getRelationshipLabel(RelationshipTypeEnum.COUSIN),
      icon: 'people-outline',
      description: 'A cousin'
    },
    {
      value: RelationshipTypeEnum.IN_LAW,
      label: getRelationshipLabel(RelationshipTypeEnum.IN_LAW),
      icon: 'people-outline',
      description: 'An in-law or extended family'
    },
    {
      value: RelationshipTypeEnum.GUARDIAN,
      label: getRelationshipLabel(RelationshipTypeEnum.GUARDIAN),
      icon: 'shield-checkmark-outline',
      description: 'A legal guardian or caregiver'
    },
    {
      value: RelationshipTypeEnum.OTHER,
      label: getRelationshipLabel(RelationshipTypeEnum.OTHER),
      icon: 'people-outline',
      description: 'Other family relationship'
    }
  ];

  constructor() {
    this.addIcons();
    this.initializeForm();
  }

  ngOnInit() {
    // Set current values if provided
    if (this.currentRelationship) {
      this.relationshipForm.patchValue({
        relationshipType: this.currentRelationship,
        isGuardian: this.currentIsGuardian
      });
    }
  }

  private addIcons() {
    addIcons({
      closeOutline, peopleOutline, heartOutline, checkmarkOutline,
      shieldCheckmarkOutline
    });
  }

  private initializeForm() {
    this.relationshipForm = this.formBuilder.group({
      relationshipType: [RelationshipTypeEnum.OTHER, [
        Validators.required
      ]],
      isGuardian: [false]
    });
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  async onSaveRelationship() {
    if (!this.relationshipForm.valid) {
      return;
    }

    const result: RelationshipResult = {
      relationshipType: this.relationshipForm.value.relationshipType,
      isGuardian: this.relationshipForm.value.isGuardian
    };

    await this.modalController.dismiss(result, 'confirm');
  }

  selectRelationship(relationshipType: RelationshipTypeEnum) {
    this.relationshipForm.patchValue({ relationshipType });
  }

  getRelationshipLabel(type: RelationshipTypeEnum): string {
    return getRelationshipLabel(type);
  }
}
