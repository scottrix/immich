import { BadRequestException, Injectable } from '@nestjs/common';
import { Partner } from 'src/database';
import { AuthDto } from 'src/dtos/auth.dto';
import { PartnerCreateDto, PartnerResponseDto, PartnerSearchDto, PartnerUpdateDto } from 'src/dtos/partner.dto';
import { mapUser } from 'src/dtos/user.dto';
import { Permission } from 'src/enum';
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

  async update(auth: AuthDto, sharedById: string, dto: PartnerUpdateDto): Promise<PartnerResponseDto> {
    await this.requireAccess({ auth, permission: Permission.PartnerUpdate, ids: [sharedById] });
    const partnerId: PartnerIds = { sharedById, sharedWithId: auth.user.id };

    const entity = await this.partnerRepository.update(partnerId, { 
      inTimeline: dto.inTimeline,
      shareAllAlbums: dto.shareAllAlbums
    });
    
    // If shareAllAlbums is being enabled, share all albums with the partner
    if (dto.shareAllAlbums) {
      await this.shareAllAlbumsWithPartner(auth, sharedById);
    }
    
    return this.mapPartner(entity, PartnerDirection.SharedWith);
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
            role: 'editor'
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
