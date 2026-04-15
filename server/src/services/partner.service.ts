import { BadRequestException, Injectable } from '@nestjs/common';
import { Partner } from 'src/database';
import { AuthDto } from 'src/dtos/auth.dto';
import { PartnerCreateDto, PartnerResponseDto, PartnerSearchDto, PartnerUpdateDto } from 'src/dtos/partner.dto';
import { mapUser } from 'src/dtos/user.dto';
import { AlbumUserRole, Permission } from 'src/enum';
import { PartnerDirection, PartnerIds } from 'src/repositories/partner.repository';
import { BaseService } from 'src/services/base.service';

@Injectable()
export class PartnerService extends BaseService {
  async create(auth: AuthDto, { sharedWithId }: PartnerCreateDto): Promise<PartnerResponseDto> {
    const partnerId: PartnerIds = { sharedById: auth.user.id, sharedWithId };
    const exists = await this.partnerRepository.get(partnerId);
    if (exists) {
      throw new BadRequestException(`Partner already exists`);
    }

    const partner = await this.partnerRepository.create(partnerId);
    return this.mapPartner(partner, PartnerDirection.SharedBy);
  }

  async remove(auth: AuthDto, sharedWithId: string): Promise<void> {
    const partnerId: PartnerIds = { sharedById: auth.user.id, sharedWithId };
    const partner = await this.partnerRepository.get(partnerId);
    if (!partner) {
      throw new BadRequestException('Partner not found');
    }

    await this.partnerRepository.remove(partnerId);
  }

  async search(auth: AuthDto, { direction }: PartnerSearchDto): Promise<PartnerResponseDto[]> {
    const partners = await this.partnerRepository.getAll(auth.user.id);
    const key = direction === PartnerDirection.SharedBy ? 'sharedById' : 'sharedWithId';
    return partners
      .filter((partner): partner is Partner => !!(partner.sharedBy && partner.sharedWith)) // Filter out soft deleted users
      .filter((partner) => partner[key] === auth.user.id)
      .map((partner) => this.mapPartner(partner, direction));
  }

async update(auth: AuthDto, partnerId: string, dto: PartnerUpdateDto): Promise<PartnerResponseDto> {
    // Debug: log what we received
    console.log('PartnerUpdateDto received:', JSON.stringify(dto));

    // Check if I'm sharing with this partner (I'm the sharer, they're sharedWith)
    const meSharing = await this.partnerRepository.get({
        sharedById: auth.user.id,
        sharedWithId: partnerId,
    });

    // Check if this partner is sharing with me (they're the sharer, I'm sharedWith)
    const themSharing = await this.partnerRepository.get({
        sharedById: partnerId,
        sharedWithId: auth.user.id,
    });

    // shareAllAlbums should update the partner relationship where I'm the sharer
    // inTimeline should update the partner relationship where they're the sharer

    let entity;
    let direction: PartnerDirection;

    if (dto.shareAllAlbums !== undefined) {
        // shareAllAlbums is for when I'm sharing with someone
        // Need to verify the partner relationship exists where I'm the sharer
        if (!meSharing) {
            throw new BadRequestException('Partner relationship not found');
        }
        entity = await this.partnerRepository.update(
            { sharedById: auth.user.id, sharedWithId: partnerId },
            { shareAllAlbums: dto.shareAllAlbums },
        );
        if (dto.shareAllAlbums) {
            await this.shareAllAlbumsWithPartner(auth, partnerId);
        }
        direction = PartnerDirection.SharedBy;
    } else if (dto.inTimeline !== undefined) {
        // inTimeline is for when someone is sharing with me
        // Use standard access check for this case
        await this.requireAccess({ auth, permission: Permission.PartnerUpdate, ids: [partnerId] });
        if (!themSharing) {
            throw new BadRequestException('Partner relationship not found');
        }
        entity = await this.partnerRepository.update(
            { sharedById: partnerId, sharedWithId: auth.user.id },
            { inTimeline: dto.inTimeline },
        );
        direction = PartnerDirection.SharedWith;
    } else {
        throw new BadRequestException('No valid update fields provided');
    }

    return this.mapPartner(entity, direction);
}

  private async shareAllAlbumsWithPartner(auth: AuthDto, partnerId: string): Promise<void> {
    // Get all albums owned by the current user
    const albums = await this.albumRepository.getOwned(auth.user.id);
    
    // Share each album with the partner
    for (const album of albums) {
      // Check if the album is already shared with the partner
      const existingShare = album.albumUsers?.find(user => user.user.id === partnerId);
      
      // If not already shared, add the partner as an editor
      if (!existingShare) {
        try {
          await this.albumUserRepository.create({
            albumId: album.id,
            userId: partnerId,
            role: AlbumUserRole.Editor
          });
        } catch (error) {
          // Ignore duplicate key errors (album already shared)
          if (!(error instanceof Error && error.message.includes('duplicate key'))) {
            throw error;
          }
        }
      }
    }
  }

  private mapPartner(partner: Partner, direction: PartnerDirection): PartnerResponseDto {
    // this is opposite to return the non-me user of the "partner"
    const sharedUser = direction === PartnerDirection.SharedBy ? partner.sharedWith : partner.sharedBy;
    const user = mapUser(sharedUser);

    return { 
      ...user, 
      inTimeline: partner.inTimeline,
      shareAllAlbums: partner.shareAllAlbums
    };
  }
}
