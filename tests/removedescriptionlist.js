'use strict';

suite( 'Description list - removing from a single list' );

test( 'on a list with single dt', function() {
	tests.setHtmlWithSelection( '<dl><dt>[]foo</dt></dl>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<p>[]foo</p>', tests.getHtmlWithSelection() );
} );

test( 'on a list with single dd', function() {
	tests.setHtmlWithSelection( '<dl><dd>[]foo</dd></dl>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<p>[]foo</p>', tests.getHtmlWithSelection() );
} );

test( 'on a dd preceded by dt', function() {
	tests.setHtmlWithSelection( '<dl><dt>x</dt><dd>[]foo</dd></dl>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<dl><dt>x</dt></dl><p>[]foo</p>', tests.getHtmlWithSelection() );
} );

test( 'between items', function() {
	tests.setHtmlWithSelection( '<dl><dt>x</dt><dd>[]foo</dd><dt>y</dt></dl>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<dl><dt>x</dt></dl><p>[]foo</p><dl><dt>y</dt></dl>', tests.getHtmlWithSelection() );
} );

test( 'on a multi-item list', function() {
	tests.setHtmlWithSelection( '<dl><dt>[x</dt><dd>foo</dd><dt>y]</dt></dl>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<p>[x</p><p>foo</p><p>y]</p>', tests.getHtmlWithSelection() );
} );

test( 'on a part of multi-item list', function() {
	tests.setHtmlWithSelection( '<dl><dt>x</dt><dd>[foo</dd><dd>bar]</dd><dt>y</dt></dl>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<dl><dt>x</dt></dl><p>[foo</p><p>bar]</p><dl><dt>y</dt></dl>', tests.getHtmlWithSelection() );
} );

test( 'on a selection ending outside of list', function() {
	tests.setHtmlWithSelection( '<dl><dt>x</dt><dd>[foo</dd></dl><p>y</p><ul><li>z]</li></ul>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<dl><dt>x</dt></dl><p>[foo</p><p>y</p><ul><li>z]</li></ul>', tests.getHtmlWithSelection() );
} );

test( 'through an ordered list', function() {
	tests.setHtmlWithSelection( '<dl><dt>[x</dt></dl><ul class="foo"><li>a</li><li>b</li></ul><p>y]</p>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<p>[x</p><ul class="foo"><li>a</li><li>b</li></ul><p>y]</p>', tests.getHtmlWithSelection() );
} );

suite( 'Description list - removing from a multiple lists' );

test( 'start and end in different lists', function() {
	tests.setHtmlWithSelection( '<dl><dt>x</dt><dd>[foo</dd></dl><p>y</p><dl><dt>bar]</dt><dd>z</dd></dl>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<dl><dt>x</dt></dl><p>[foo</p><p>y</p><p>bar]</p><dl><dd>z</dd></dl>', tests.getHtmlWithSelection() );
} );

test( 'start and end in different lists - full selection', function() {
	tests.setHtmlWithSelection( '<dl><dd>[foo</dd></dl><p>y</p><dl><dt>bar]</dt></dl>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<p>[foo</p><p>y</p><p>bar]</p>', tests.getHtmlWithSelection() );
} );

test( 'two lists, ending in paragraph', function() {
	tests.setHtmlWithSelection( '<dl><dt>x</dt><dd>[foo</dd></dl><p>y</p><dl><dt>bar</dt></dl><p>z]</p>' );
	tests.editor.execCommand( 'descriptionList' );
	assert.areSame( '<dl><dt>x</dt></dl><p>[foo</p><p>y</p><p>bar</p><p>z]</p>', tests.getHtmlWithSelection() );
} );