'use strict';

( function() {

	var listElementNames = { dt: 1, dd: 1 },
		allListElementNames = { li: 1, dt: 1, dd: 1 };

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
						plugin.removeListFromRange( editor, range );
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
		/**
		 * Note: range must not start in description list.
		 */
		createListFromRange: function( editor, range ) {
			var bm = range.createBookmark(),
				iterator = range.createIterator(),
				blocks = [],
				// Lists (dl,ol,ul) that we may empty when moving blocks
				// to newly created dl. These lists should be removed.
				listsToCheck = [],
				startWithDt = true,
				lastBlockParent, dl, block;

			// Check first node before block in which selection starts.
			// If it's a dl then we'll append new elements to the existing list.
			if ( ( dl = findPrecedingListContainer( range ) ) ) {
				startWithDt = listEndsWithDd( dl );
			}

			// Scan range and remember all blocks.
			while ( ( block = iterator.getNextParagraph() ) ) {
				blocks.push( block );
			}

			// If list container has not been created yet, create it now from the
			// first block.
			if ( !dl ) {
				dl = this.createListContainer( editor, blocks[ 0 ] );
			}

			// We need to remember last block's parent now, cause we'll lost it after
			// moving blocks to created list.
			if ( blocks.length > 1 ) {
				lastBlockParent = blocks[ blocks.length - 1 ].getParent();
			}

			moveBlocksToListContainer( dl, blocks, startWithDt, listsToCheck );

			// Remove list containers that we could empty when moving
			// block (in this case list items) to definition list container.
			cleanUpEmptiedLists( listsToCheck );

			if ( lastBlockParent && lastBlockParent.is( 'li' ) && isBlockEmpty( lastBlockParent ) ) {
				lastBlockParent.remove();
			}

			// If newly create list is followed by another list, merge them.
			mergeToFollowingListContainer( dl );

			range.moveToBookmark( bm );
		},

		/**
		 * Note: range must start in description list.
		 */
		removeListFromRange: function( editor, range ) {
			var bm = range.createBookmark(),
				iterator = range.createIterator(),
				block,
				firstBlock,
				blocks = [];

			while ( ( block = iterator.getNextParagraph() ) ) {
				if ( block.is( listElementNames ) ) {
					blocks.push( block );
				}
			}

			var block = blocks.shift();

			var currentList = block.getParent(),
				splitRange = editor.createRange(),
				listsToCheck = [ currentList ],
				list;

			splitRange.moveToPosition( block, CKEDITOR.POSITION_BEFORE_START );
			currentList = splitRange.splitElement( currentList );
			listsToCheck.push( currentList );
			block.renameNode( 'p' );
			block.insertBefore( currentList );

			while ( ( block = blocks.shift() ) ) {
				if ( block.getParent().equals( currentList ) ) {
					block.renameNode( 'p' );
					block.insertBefore( currentList );
				} else {
					splitRange.moveToPosition( block, CKEDITOR.POSITION_BEFORE_START );
					currentList = splitRange.splitElement( currentList );
					listsToCheck.push( currentList );
					block.renameNode( 'p' );
					block.insertBefore( currentList );
				}
			}

			while ( ( list = listsToCheck.pop() ) ) {
				if ( list.getParent && isBlockEmpty( list ) ) {
					list.remove();
				}
			}

			range.moveToBookmark( bm );
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

	// Checks passed list containers (ul, ol, dl) and removes empty ones.
	// @param {CKEDITOR.dom.element[]} listsToCheck
	function cleanUpEmptiedLists( listsToCheck ) {
		var list;

		while ( ( list = listsToCheck.shift() ) ) {
			// It could be already removed.
			if ( list.getParent() && isBlockEmpty( list ) ) {
				list.remove();
			}
		}
	}

	// @returns {Boolean} Whether next list element should be a dt.
	function createListElement( dl, block, createDt ) {
		// It may happen that we are processing a block which already is a dt or dd
		// (e.g. we're extending a dl). Just move the block to new dl container.
		if ( block.is( listElementNames ) ) {
			block.appendTo( dl );

			return block.is( 'dd' );
		} else {
			var newBlock = block.getDocument().createElement( createDt ? 'dt' : 'dd' );
			block.moveChildren( newBlock );
			newBlock.appendTo( dl );
			block.remove();

			return !createDt;
		}
	}

	// Finds list container that precedes block in which range starts.
	// @returns CKEDITOR.dom.element List container or null.
	function findPrecedingListContainer( range ) {
		var previousNode = range.startPath().block.getPrevious( isNotIgnored );

		return ( previousNode && isDl( previousNode ) ) ? previousNode : null;
	}

	// Returns dl, ol or ul element being direct parent or
	// parent's parent of passed block.
	function getWrappingList( block ) {
		var blockParent = block.getParent();

		if ( block.is( allListElementNames ) ) {
			return blockParent;
		// <li> cannot be the editable, so we don't have to check whether
		// we're not leaking from it.
		} else if ( blockParent && blockParent.is( allListElementNames ) ) {
			return blockParent.getParent();
		}
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

	function isDtOrDd( node ) {
		return node.type == CKEDITOR.NODE_ELEMENT && node.is( listElementNames );
	}

	var isNotIgnored = CKEDITOR.dom.walker.ignored( true ),
		isDl = isElement( 'dl' );

	// Checks if list ends with a dd element.
	// @returns {Boolean}
	function listEndsWithDd( dl ) {
		var lastElement = dl.getLast( isDtOrDd );
		return lastElement ? lastElement.is( 'dd' ) : false;
	}

	// Looks for list container that follows the passed one
	// and if found moves children of the passed one to the following one.
	function mergeToFollowingListContainer( dl ) {
		var nextNode = dl.getNext( isNotIgnored );

		if ( nextNode && isDl( nextNode ) ) {
			dl.moveChildren( nextNode, true );
			dl.remove();
		}
	}

	// @param {CKEDITOR.dom.element} dl List container to which blocks will be appended.
	// @param {CKEDITOR.dom.element[]} blocks Blocks that will be transformed to dt/dd and appended
	// to list container.
	// @param {Boolean} startWithDt Whether first block should be transformed to dt or dd.
	// @param {CKEDITOR.dom.element[]} Array to which lists containers (ul, ol, dl) that might
	// be emptied when moving blocks will be pushed.
	function moveBlocksToListContainer( dl, blocks, startWithDt, listsToCheck ) {
		var i = 0,
			createDt = startWithDt,
			list, block;

		for ( ; i < blocks.length; ++i ) {
			block = blocks[ i ];

			list = getWrappingList( block );
			if ( list ) {
				listsToCheck.push( list );
			}

			createDt = createListElement( dl, block, createDt );
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