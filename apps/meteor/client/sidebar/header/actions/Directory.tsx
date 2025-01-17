import { Sidebar } from '@rocket.chat/fuselage';
import { useMutableCallback } from '@rocket.chat/fuselage-hooks';
import { useLayout, useRouter } from '@rocket.chat/ui-contexts';
import type { HTMLAttributes } from 'react';
import React from 'react';

type DirectoryProps = Omit<HTMLAttributes<HTMLElement>, 'is'>;

const Directory = (props: DirectoryProps) => {
	const router = useRouter();
	const { sidebar } = useLayout();
	const handleDirectory = useMutableCallback(() => {
		sidebar.toggle();
		router.navigate('/directory');
	});

	return (
		<Sidebar.TopBar.Action
			{...props}
			icon='notebook-hashtag'
			onClick={handleDirectory}
			pressed={router.getLocationPathname().includes('/directory')}
		/>
	);
};

export default Directory;
