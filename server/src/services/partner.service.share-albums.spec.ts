import { BadRequestException } from '@nestjs/common';
import { AlbumUserRole, PartnerDirection } from 'src/enum';
import { PartnerIds } from 'src/repositories/partner.repository';
import { PartnerService } from 'src/services/partner.service';
import { AlbumFactory } from 'test/factories/album.factory';
import { AuthFactory } from 'test/factories/auth.factory';
import { PartnerFactory } from 'test/factories/partner.factory';
import { UserFactory } from 'test/factories/user.factory';
import { getForAlbum, getForPartner } from 'test/mappers';
import { newTestService, ServiceMocks } from 'test/utils';

describe(PartnerService.name + ' - Share All Albums', () => {
  let sut: PartnerService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PartnerService));
  });

  it('should work', () => {
    expect(sut).toBeDefined();
  });

  describe('update with shareAllAlbums', () => {
    it('should update partner with shareAllAlbums setting', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.access.partner.checkUpdateAccess.mockResolvedValue(new Set([user2.id]));
      mocks.partner.update.mockResolvedValue(getForPartner(partner));

      await expect(sut.update(auth, user2.id, { inTimeline: true, shareAllAlbums: true })).resolves.toBeDefined();
      expect(mocks.partner.update).toHaveBeenCalledWith(
        { sharedById: user2.id, sharedWithId: user1.id },
        { inTimeline: true, shareAllAlbums: true },
      );
    });

    it('should share all albums when shareAllAlbums is enabled', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const album1 = AlbumFactory.from().owner(user1).build();
      const album2 = AlbumFactory.from().owner(user1).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.access.partner.checkUpdateAccess.mockResolvedValue(new Set([user2.id]));
      mocks.partner.update.mockResolvedValue(getForPartner(partner));
      mocks.album.getOwned.mockResolvedValue([getForAlbum(album1), getForAlbum(album2)]);
      mocks.albumUser.create.mockResolvedValue();

      await sut.update(auth, user2.id, { inTimeline: true, shareAllAlbums: true });

      expect(mocks.album.getOwned).toHaveBeenCalledWith(user1.id);
      expect(mocks.albumUser.create).toHaveBeenCalledTimes(2);
      expect(mocks.albumUser.create).toHaveBeenCalledWith({
        albumId: album1.id,
        userId: user2.id,
        role: AlbumUserRole.Editor,
      });
      expect(mocks.albumUser.create).toHaveBeenCalledWith({
        albumId: album2.id,
        userId: user2.id,
        role: AlbumUserRole.Editor,
      });
    });

    it('should not share albums that are already shared with the partner', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const album1 = AlbumFactory.from().owner(user1).build();
      const album2 = AlbumFactory.from().owner(user1).build();
      album2.albumUsers = [{ user: user2, role: AlbumUserRole.Editor }];
      const auth = AuthFactory.create({ id: user1.id });

      mocks.access.partner.checkUpdateAccess.mockResolvedValue(new Set([user2.id]));
      mocks.partner.update.mockResolvedValue(getForPartner(partner));
      mocks.album.getOwned.mockResolvedValue([getForAlbum(album1), getForAlbum(album2)]);

      await sut.update(auth, user2.id, { inTimeline: true, shareAllAlbums: true });

      expect(mocks.album.getOwned).toHaveBeenCalledWith(user1.id);
      expect(mocks.albumUser.create).toHaveBeenCalledTimes(1);
      expect(mocks.albumUser.create).toHaveBeenCalledWith({
        albumId: album1.id,
        userId: user2.id,
        role: AlbumUserRole.Editor,
      });
    });

    it('should handle duplicate key errors when sharing albums', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const album1 = AlbumFactory.from().owner(user1).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.access.partner.checkUpdateAccess.mockResolvedValue(new Set([user2.id]));
      mocks.partner.update.mockResolvedValue(getForPartner(partner));
      mocks.album.getOwned.mockResolvedValue([getForAlbum(album1)]);
      mocks.albumUser.create.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      await expect(sut.update(auth, user2.id, { inTimeline: true, shareAllAlbums: true })).resolves.toBeDefined();
      expect(mocks.album.getOwned).toHaveBeenCalledWith(user1.id);
      expect(mocks.albumUser.create).toHaveBeenCalledTimes(1);
    });

    it('should re-throw non-duplicate errors when sharing albums', async () => {
      const user1 = UserFactory.create();
      const user2 = UserFactory.create();
      const partner = PartnerFactory.from().sharedBy(user1).sharedWith(user2).build();
      const album1 = AlbumFactory.from().owner(user1).build();
      const auth = AuthFactory.create({ id: user1.id });

      mocks.access.partner.checkUpdateAccess.mockResolvedValue(new Set([user2.id]));
      mocks.partner.update.mockResolvedValue(getForPartner(partner));
      mocks.album.getOwned.mockResolvedValue([getForAlbum(album1)]);
      mocks.albumUser.create.mockRejectedValue(new Error('some other error'));

      await expect(sut.update(auth, user2.id, { inTimeline: true, shareAllAlbums: true })).rejects.toThrow('some other error');
    });
  });
});