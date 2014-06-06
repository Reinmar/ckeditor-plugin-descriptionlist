'use strict';

( function() {

	var listElementNames = { dt: 1, dd: 1 };

	CKEDITOR.plugins.add( 'descriptionlist', {
		lang: 'en',
		init: function( editor ) {
			if ( editor.blockless ) {
				return;
			}

			var lang = editor.lang.descriptionlist,
				plugin = CKEDITOR.plugins.descriptionList;

			editor.addCommand( 'descriptionList', {
				allowedContent: 'dl dt dd',
				contextSensitive: true,

				exec: function( editor ) {
					var sel = editor.getSelection(),
						range = sel.getRanges()[ 0 ];

					if ( this.state == CKEDITOR.TRISTATE_OFF ) {
						plugin.createListFromRange( editor, range );
					} else {
						plugin.removeFrom( editor, range );
					}

					sel.selectRanges( [ range ] );
				},

				refresh: function( editor, path ) {
					var dl = path.contains( 'dl', 1 );
					this.setState( dl ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF );
				}
			} );

			editor.addCommand( 'descriptionTerm', {
				contextSensitive: true,

				exec: function( editor ) {
					var sel = editor.getSelection(),
						range = sel.getRanges()[ 0 ];

					plugin.toggleListElementsTo( editor, range, this.state == CKEDITOR.TRISTATE_OFF ? 'dt' : 'dd' );

					sel.selectRanges( [ range ] );
				},

				refresh: refreshDtDdCallback( 'dt' )
			} );

			editor.addCommand( 'descriptionValue', {
				contextSensitive: true,

				exec: function( editor ) {
					var sel = editor.getSelection(),
						range = sel.getRanges()[ 0 ];

					plugin.toggleListElementsTo( editor, range, this.state == CKEDITOR.TRISTATE_OFF ? 'dd' : 'dt' );

					sel.selectRanges( [ range ] );
				},

				refresh: refreshDtDdCallback( 'dd' )
			} );

			editor.ui.addButton && editor.ui.addButton( 'DescriptionList', {
				label: lang.descriptionList,
				command: 'descriptionList',
				toolbar: 'list,100'
			} );
			editor.ui.addButton && editor.ui.addButton( 'DescriptionTerm', {
				label: lang.descriptionTerm,
				command: 'descriptionTerm',
				toolbar: 'list,110'
			} );
			editor.ui.addButton && editor.ui.addButton( 'descriptionValue', {
				label: lang.descriptionValue,
				command: 'descriptionValue',
				toolbar: 'list,120'
			} );
		}
	} );

	CKEDITOR.plugins.descriptionList = {
		createListFromRange: function( editor, range ) {
			var bm = range.createBookmark(),
				iterator = range.createIterator(),
				block,
				blocks = [],
				list,
				listsToCheck = [],
				dl,
				createDt = true,
				i, lastBlockParent;

			while ( ( block = iterator.getNextParagraph() ) ) {
				blocks.push( block );
			}

			dl = this.createListContainer( editor, blocks[ 0 ] );

			// We need to remember last block's parent now, cause we'll lost it after
			// moving blocks to created list.
			if ( blocks.length > 1 ) {
				lastBlockParent = blocks[ blocks.length - 1 ].getParent();
			}

			for ( i = 0; i < blocks.length; ++i ) {
				block = blocks[ i ];

				list = getWrappingList( block );
				if ( list ) {
					listsToCheck.push( list );
				}

				createListElement( dl, block, createDt );
				createDt = !createDt;
			}

			while ( ( list = listsToCheck.shift() ) ) {
				// It could already be removed.
				if ( list.getParent() && isBlockEmpty( list ) ) {
					list.remove();
				}
			}

			if ( lastBlockParent && lastBlockParent.is( 'li' ) && isBlockEmpty( lastBlockParent ) ) {
				lastBlockParent.remove();
			}

			range.moveToBookmark( bm );
		},

		// Requirement - range starts in dl.
		removeFrom: function( editor, range ) {
			var bm = range.createBookmark(),
				iterator = range.createIterator(),
				block,
				firstBlock,
				blocks = [];

			while ( ( block = iterator.getNextParagraph() ) ) {
				blocks.push( block );
			}

			firstBlock = blocks[ 0 ];

			var splitRange = editor.createRange();
			splitRange.moveToPosition( firstBlock, CKEDITOR.POSITION_BEFORE_START );
			var firstDl = firstBlock.getAscendant( 'dl' ),
				secondDl = splitRange.splitElement( firstDl );

			while ( ( block = blocks.shift() ) ) {
				this.turnToParagraph( block ).insertBefore( secondDl );
			}

			range.moveToBookmark( bm );
		},

		// If not a DT/DD, then return.
		// If DT/DD create new P, move all children, detach old element and return new one.
		turnToParagraph: function( block ) {
			if ( !block.is( listElementNames ) ) {
				return block;
			}

			var newBlock = block.getDocument().createElement( 'p' );
			block.moveChildren( newBlock );
			block.remove();
			return newBlock;
		},

		createListContainer: function( editor, block ) {
			var dl = editor.document.createElement( 'dl' ),
				blockParent = block.getParent(),
				list = getWrappingList( block ),
				secondList, splitRange;

			if ( list ) {
				splitRange = editor.createRange();
				splitRange.moveToPosition( block, CKEDITOR.POSITION_BEFORE_START );
				secondList = splitRange.splitElement( list );
			}

			dl.insertBefore( list ? secondList : block );

			// We need to remove block now, so if it was the list item in
			// <ul><li></li></ul> we'll have an empty list which we'll be able to remove.
			block.remove();

			if ( list ) {
				// Split might result in leaving: <ul></ul><dl></dl>...
				if ( isBlockEmpty( list ) ) {
					list.remove();

				// It could also result in: <ul><li></li></ul><dl></dl>...
				// if the passed block was a block inside list item (e.g. <li><p></p></li>).
				} else if ( !block.is( 'li' ) && isBlockEmpty( blockParent ) ) {
					blockParent.remove();
				}
			}

			// Do the same as above, but for the list after created <dl>.
			// Note - this works only in case of a collapsed range.
			if ( secondList ) {
				if ( isBlockEmpty( secondList ) ) {
					secondList.remove();
				} else if ( !block.is( 'li' ) ) {
					// But this time we have to find the list item.
					var listItem = secondList.getFirst( isElement( 'li' ) );
					if ( listItem && isBlockEmpty( listItem ) ) {
						listItem.remove();
					}
				}
			}

			return dl;
		},

		toggleListElementsTo: function( editor, range, toggleTo ) {
			var bm = range.createBookmark(),
				walkerRange = editor.createRange(),
				walker,
				isElementToToggle = isElement( toggleTo == 'dt' ? 'dd' : 'dt' ),
				elementsToToggle = [],
				node;

			walkerRange.setStartAt( range.startPath().contains( listElementNames ), CKEDITOR.POSITION_BEFORE_START );
			walkerRange.setEndAt( range.endPath().contains( listElementNames ), CKEDITOR.POSITION_AFTER_START );
			walker = new CKEDITOR.dom.walker( walkerRange );

			while ( ( node = walker.next() ) ) {
				if ( isElementToToggle ( node ) ) {
					elementsToToggle.push( node );
				}
			}

			while ( ( node = elementsToToggle.pop() ) ) {
				node.renameNode( toggleTo );
			}

			range.moveToBookmark( bm );
		}
	};

	function createListElement( dl, block, createDt ) {
		var newBlock = block.getDocument().createElement( createDt ? 'dt' : 'dd' );
		block.moveChildren( newBlock );
		newBlock.appendTo( dl );
		block.remove();
		return newBlock;
	}

	function isBlockEmpty( list ) {
		var isNotIgnored = CKEDITOR.dom.walker.ignored( true ),
			range = new CKEDITOR.dom.range( list.getDocument() ),
			walker;

		range.selectNodeContents( list );

		walker = new CKEDITOR.dom.walker( range );
		walker.evaluator = function( node ) {
			if ( node.type == CKEDITOR.NODE_ELEMENT ) {
				return node.is( CKEDITOR.dtd.$empty );
			} else {
				return isNotIgnored( node );
			}
		};

		return !walker.next();
	}

	function isElement( elementName ) {
		return function( node ) {
			return node.type == CKEDITOR.NODE_ELEMENT && node.is( elementName );
		};
	}

	function getWrappingList( block ) {
		var blockParent = block.getParent();

		if ( block.is( 'li' ) ) {
			return blockParent;
		// <li> cannot be the editable, so we don't have to check whether
		// we're not leaking from it.
		} else if ( blockParent && blockParent.is( 'li' ) ) {
			return blockParent.getParent();
		}
	}

	function refreshDtDdCallback( dlOrDt ) {
		var names = { dl: 1 };
		names[ dlOrDt ] = 1;

		return function( editor, path ) {
			var listElement = path.contains( names, 1 );

			if ( !listElement ) {
				this.setState( CKEDITOR.TRISTATE_DISABLED );
			} else {
				this.setState( listElement.is( dlOrDt ) ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF );
			}
		};
	}

} )();