import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import type { IUser } from '@rocket.chat/core-typings';
import { isOmnichannelRoom } from '@rocket.chat/core-typings';
import { LivechatRooms } from '@rocket.chat/models';

import { roomCoordinator } from '../../../server/lib/rooms/roomCoordinator';
import { callbacks } from '../../../lib/callbacks';
import { settings } from '../../settings/server';
import { LivechatAgentActivityMonitor } from './statistics/LivechatAgentActivityMonitor';
import { businessHourManager } from './business-hour';
import { createDefaultBusinessHourIfNotExists } from './business-hour/Helper';
import { hasPermissionAsync } from '../../authorization/server/functions/hasPermission';
import { Livechat } from './lib/Livechat';
import { RoutingManager } from './lib/RoutingManager';
import './roomAccessValidator.internalService';
import { i18n } from '../../../server/lib/i18n';
import { beforeLeaveRoomCallback } from '../../../lib/callbacks/beforeLeaveRoomCallback';

Meteor.startup(async () => {
	roomCoordinator.setRoomFind('l', (_id) => LivechatRooms.findOneById(_id));

	beforeLeaveRoomCallback.add(
		function (user, room) {
			if (!isOmnichannelRoom(room)) {
				return;
			}
			throw new Meteor.Error(
				i18n.t('You_cant_leave_a_livechat_room_Please_use_the_close_button', {
					lng: user.language || settings.get('Language') || 'en',
				}),
			);
		},
		callbacks.priority.LOW,
		'cant-leave-omnichannel-room',
	);

	callbacks.add(
		'beforeJoinRoom',
		async function (user, room) {
			if (isOmnichannelRoom(room) && !(await hasPermissionAsync(user._id, 'view-l-room'))) {
				throw new Meteor.Error('error-user-is-not-agent', 'User is not an Omnichannel Agent', {
					method: 'beforeJoinRoom',
				});
			}

			return user;
		},
		callbacks.priority.LOW,
		'cant-join-omnichannel-room',
	);

	const monitor = new LivechatAgentActivityMonitor();

	settings.watch<boolean>('Troubleshoot_Disable_Livechat_Activity_Monitor', async (value) => {
		if (value) {
			return monitor.stop();
		}

		await monitor.start();
	});
	await createDefaultBusinessHourIfNotExists();

	settings.watch<boolean>('Livechat_enable_business_hours', async (value) => {
		Livechat.logger.debug(`Changing business hour type to ${value}`);
		if (value) {
			await businessHourManager.startManager();
			Livechat.logger.debug(`Business hour manager started`);
			return;
		}
		await businessHourManager.stopManager();
		Livechat.logger.debug(`Business hour manager stopped`);
	});

	settings.watch<string>('Livechat_Routing_Method', function (value) {
		RoutingManager.setMethodNameAndStartQueue(value);
	});

	// Remove when accounts.onLogout is async
	Accounts.onLogout(
		({ user }: { user: IUser }) =>
			user?.roles?.includes('livechat-agent') &&
			!user?.roles?.includes('bot') &&
			void Livechat.setUserStatusLivechatIf(user._id, 'not-available', {}, { livechatStatusSystemModified: true }).catch(),
	);
});
