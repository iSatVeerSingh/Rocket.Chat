import type { AtLeast, IRoom, IUser } from '@rocket.chat/core-typings';
import { Users } from '@rocket.chat/models';
import { ServiceClassInternal, Authorization } from '@rocket.chat/core-services';
import type { ICreateRoomParams, IRoomService } from '@rocket.chat/core-services';

import { createRoom } from '../../../app/lib/server/functions/createRoom'; // TODO remove this import
import { createDirectMessage } from '../../methods/createDirectMessage';
import { addUserToRoom } from '../../../app/lib/server/functions/addUserToRoom';
import { removeUserFromRoom } from '../../../app/lib/server/functions/removeUserFromRoom';
import { getValidRoomName } from '../../../app/utils/server/lib/getValidRoomName';
import { saveRoomTopic } from '../../../app/channel-settings/server/functions/saveRoomTopic';
import { roomCoordinator } from '../../lib/rooms/roomCoordinator';

export class RoomService extends ServiceClassInternal implements IRoomService {
	protected name = 'room';

	async create(uid: string, params: ICreateRoomParams): Promise<IRoom> {
		const { type, name, members = [], readOnly, extraData, options } = params;

		const hasPermission = await Authorization.hasPermission(uid, `create-${type}`);
		if (!hasPermission) {
			throw new Error('no-permission');
		}

		const user = await Users.findOneById<Pick<IUser, 'username'>>(uid, {
			projection: { username: 1 },
		});
		if (!user?.username) {
			throw new Error('User not found');
		}

		// TODO convert `createRoom` function to "raw" and move to here
		return createRoom(type, name, user.username, members, false, readOnly, extraData, options) as unknown as IRoom;
	}

	async createDirectMessage({ to, from }: { to: string; from: string }): Promise<{ rid: string }> {
		const [toUser, fromUser] = await Promise.all([
			Users.findOneById(to, { projection: { username: 1 } }),
			Users.findOneById(from, { projection: { _id: 1 } }),
		]);

		if (!toUser?.username || !fromUser) {
			throw new Error('error-invalid-user');
		}
		return this.createDirectMessageWithMultipleUsers([toUser.username], fromUser._id);
	}

	async createDirectMessageWithMultipleUsers(members: string[], creatorId: string): Promise<{ rid: string }> {
		return createDirectMessage(members, creatorId);
	}

	async addMember(uid: string, rid: string): Promise<boolean> {
		const hasPermission = await Authorization.hasPermission(uid, 'add-user-to-joined-room', rid);
		if (!hasPermission) {
			throw new Error('no-permission');
		}

		return true;
	}

	async addUserToRoom(
		roomId: string,
		user: Pick<IUser, '_id' | 'username'> | string,
		inviter?: Pick<IUser, '_id' | 'username'>,
		silenced?: boolean,
	): Promise<boolean | undefined> {
		return addUserToRoom(roomId, user, inviter, silenced);
	}

	async removeUserFromRoom(roomId: string, user: IUser, options?: { byUser: Pick<IUser, '_id' | 'username'> }): Promise<void> {
		return removeUserFromRoom(roomId, user, options);
	}

	async getValidRoomName(
		displayName: string,
		roomId = '',
		options: { allowDuplicates?: boolean; nameValidationRegex?: string } = {},
	): Promise<string> {
		return getValidRoomName(displayName, roomId, options);
	}

	async saveRoomTopic(
		roomId: string,
		roomTopic: string | undefined,
		user: {
			username: string;
			_id: string;
		},
		sendMessage = true,
	): Promise<void> {
		await saveRoomTopic(roomId, roomTopic, user, sendMessage);
	}

	async getRouteLink(room: AtLeast<IRoom, '_id' | 't' | 'name'>): Promise<string | boolean> {
		return roomCoordinator.getRouteLink(room.t as string, { rid: room._id, name: room.name });
	}
}
