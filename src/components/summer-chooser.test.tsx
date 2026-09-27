import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummerChooser } from './summer-chooser';

function chooser() {
  return screen.getByRole('navigation', { name: 'Choose a summer' });
}

describe('SummerChooser', () => {
  it('is a navigation landmark named Choose a summer', () => {
    render(<SummerChooser years={[2026, 2027]} selected={2027} />);
    expect(chooser()).toBeInTheDocument();
  });

  it('offers one link per summer, earliest first, each showing its year', () => {
    render(<SummerChooser years={[2026, 2027]} selected={2027} />);
    const links = within(chooser()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['2026', '2027']);
  });

  it('names each link for a screen reader as Summer and its year', () => {
    render(<SummerChooser years={[2026, 2027]} selected={2027} />);
    expect(screen.getByRole('link', { name: 'Summer 2026' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Summer 2027' })).toBeInTheDocument();
  });

  it('keeps the chosen summer in the URL', () => {
    render(<SummerChooser years={[2026, 2027]} selected={2027} />);
    expect(screen.getByRole('link', { name: 'Summer 2026' })).toHaveAttribute(
      'href',
      '/summer?summer=2026',
    );
    expect(screen.getByRole('link', { name: 'Summer 2027' })).toHaveAttribute(
      'href',
      '/summer?summer=2027',
    );
  });

  it('marks only the selected summer as current', () => {
    render(<SummerChooser years={[2026, 2027]} selected={2026} />);
    expect(screen.getByRole('link', { name: 'Summer 2026' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Summer 2027' })).not.toHaveAttribute('aria-current');
  });

  it('is shown when only one summer is on offer', () => {
    render(<SummerChooser years={[2027]} selected={2027} />);
    expect(within(chooser()).getAllByRole('link')).toHaveLength(1);
  });
});
