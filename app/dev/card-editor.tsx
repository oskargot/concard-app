/**
 * The card editor on local state — no Supabase, no sign-in.
 *
 * Same pieces as `app/card/edit.tsx` (`EditorStage`, `Card` with `edit`,
 * `FitNotes`, `LinkRows`), minus the loading and autosave, so the divider, the
 * in-place text fields, the fit notices and the link flow can be exercised on
 * a device or in the web preview before an account or a card exists.
 */

import { useMemo, useState } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	useWindowDimensions
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/card/Card';
import {
	ALIGNMENTS,
	ALIGNMENT_LABEL,
	FRAME_KEYS,
	FRAME_LABEL,
	PHOTO_SHAPES,
	PHOTO_SHAPE_LABEL,
	type CardStyle
} from '@/card/card-style';
import { DEMO_CARD } from '@/card/demo-card';
import { EditorStage, stageLayout, type StyleAxis } from '@/card/editor/EditorStage';
import { FitNotes } from '@/card/editor/FitNotes';
import { LinkRows } from '@/card/editor/LinkRows';
import { foilForTier } from '@/card/tiers';
import { BIO_MAX, type CardView } from '@/card/types';
import { palette } from '@/theme/palette';
import { space, type } from '@/theme/tokens';

export default function CardEditorPlayground() {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const { cardWidth, stageWidth } = useMemo(() => stageLayout(width, space.md), [width]);
	const [view, setView] = useState<CardView>({ ...DEMO_CARD, stickers: [], pronouns: 'he/him' });
	const [dragging, setDragging] = useState(false);

	const set = (patch: Partial<CardView>) => setView((v) => ({ ...v, ...patch }));
	const setStyle = (patch: Partial<CardStyle>) =>
		setView((v) => ({ ...v, style: { ...v.style, ...patch } }));

	const axes: StyleAxis[] = [
		{
			label: 'Alignment',
			band: 'header',
			options: ALIGNMENTS,
			value: view.style.alignment,
			labelFor: (v) => ALIGNMENT_LABEL[v as (typeof ALIGNMENTS)[number]],
			onChange: (alignment) => setStyle({ alignment: alignment as never })
		},
		{
			label: 'Photo shape',
			band: 'photo',
			options: PHOTO_SHAPES,
			value: view.style.photo_shape,
			labelFor: (v) => PHOTO_SHAPE_LABEL[v as (typeof PHOTO_SHAPES)[number]],
			onChange: (photo_shape) => setStyle({ photo_shape: photo_shape as never })
		},
		{
			label: 'Edge',
			band: 'footer',
			options: FRAME_KEYS,
			value: view.style.frame,
			labelFor: (v) => FRAME_LABEL[v as (typeof FRAME_KEYS)[number]],
			onChange: (frame) => setStyle({ frame: frame as never })
		}
	];

	return (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				scrollEnabled={!dragging}
				contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxl }]}
				keyboardShouldPersistTaps="handled"
			>
				<EditorStage
					view={view}
					cardWidth={cardWidth}
					stageWidth={stageWidth}
					axes={axes}
					onPickBackground={(bg) => setStyle({ bg })}
					renderCard={(rx, ry) => (
						<Card
							view={view}
							width={cardWidth}
							foil={foilForTier(0)}
							seed="playground"
							rx={rx}
							ry={ry}
							edit={{
								onChangeTitle: (title) => set({ title }),
								onChangePronouns: (pronouns) => set({ pronouns }),
								onChangeBio: (bio) => set({ bio: bio.slice(0, BIO_MAX) }),
								bioMax: BIO_MAX,
								onChangePhotoHeight: (photo_height) => setStyle({ photo_height }),
								onInteraction: setDragging
							}}
						/>
					)}
				/>
				<FitNotes view={view} />
				<Text style={styles.hint}>
					Local state only — nothing here is saved. H = {view.style.photo_height}
				</Text>
				<LinkRows
					links={view.links}
					onChange={(links) => set({ links })}
					photoHeight={view.style.photo_height}
					stickerOverRightColumn={!!view.affiliation}
				/>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	page: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.lg },
	hint: { ...type.small, color: palette.creamFaint, textAlign: 'center' }
});
